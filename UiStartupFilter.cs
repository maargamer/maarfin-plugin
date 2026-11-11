using System.Text;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Primitives;

namespace MyJellyfinPlugin;

public sealed class PluginServiceRegistrator : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection services, IServerApplicationHost applicationHost)
    {
        services.AddTransient<IStartupFilter, MaarfinUiStartupFilter>();
    }
}

public sealed class MaarfinUiStartupFilter : IStartupFilter
{
    private const string InjectionMarker = "<!-- MAARFIN-WEB-UI -->";
    private const string InjectionMarkup =
        InjectionMarker + "\n" +
        "<link rel=\"stylesheet\" href=\"ConfigurationPage?name=maarfin-theme.css\">\n" +
        "<script defer src=\"ConfigurationPage?name=maarfin-global.js\"></script>";

    private readonly ILogger<MaarfinUiStartupFilter> _logger;

    public MaarfinUiStartupFilter(ILogger<MaarfinUiStartupFilter> logger)
    {
        _logger = logger;
        _logger.LogInformation("Maarfin web UI injection middleware initialized.");
    }

    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            app.Use(async (context, nextMiddleware) =>
            {
                var path = context.Request.Path.Value;
                if (!HttpMethods.IsGet(context.Request.Method)
                    || !IsJellyfinWebEntryPath(path))
                {
                    await nextMiddleware(context).ConfigureAwait(false);
                    return;
                }

                _logger.LogDebug("Intercepting Jellyfin web entry request at {Path}.", path);

                var request = context.Request;
                var response = context.Response;
                var originalBody = response.Body;
                var hadAcceptEncoding = request.Headers.TryGetValue("Accept-Encoding", out var acceptEncoding);
                var hadIfNoneMatch = request.Headers.TryGetValue("If-None-Match", out var ifNoneMatch);
                var hadIfModifiedSince = request.Headers.TryGetValue("If-Modified-Since", out var ifModifiedSince);
                using var buffer = new MemoryStream();

                request.Headers.Remove("Accept-Encoding");
                request.Headers.Remove("If-None-Match");
                request.Headers.Remove("If-Modified-Since");
                response.Body = buffer;

                try
                {
                    await nextMiddleware(context).ConfigureAwait(false);

                    var contentEncoding = response.Headers["Content-Encoding"];
                    if (response.StatusCode != StatusCodes.Status200OK
                        || response.ContentType is null
                        || !response.ContentType.StartsWith("text/html", StringComparison.OrdinalIgnoreCase))
                    {
                        buffer.Position = 0;
                        await buffer.CopyToAsync(originalBody, context.RequestAborted).ConfigureAwait(false);
                        return;
                    }

                    if (!StringValues.IsNullOrEmpty(contentEncoding))
                    {
                        _logger.LogWarning(
                            "Maarfin skipped UI injection for {Path} because the response was already encoded as {ContentEncoding}.",
                            path,
                            contentEncoding);
                        buffer.Position = 0;
                        await buffer.CopyToAsync(originalBody, context.RequestAborted).ConfigureAwait(false);
                        return;
                    }

                    buffer.Position = 0;
                    using var reader = new StreamReader(buffer, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
                    var html = await reader.ReadToEndAsync(context.RequestAborted).ConfigureAwait(false);

                    if (html.Contains(InjectionMarker, StringComparison.Ordinal))
                    {
                        _logger.LogDebug("Maarfin UI assets are already present in {Path}.", path);
                        var existingBytes = Encoding.UTF8.GetBytes(html);
                        response.ContentLength = existingBytes.Length;
                        response.Headers["Cache-Control"] = "no-cache";
                        response.Headers.Remove("ETag");
                        await originalBody.WriteAsync(existingBytes, context.RequestAborted).ConfigureAwait(false);
                        return;
                    }

                    var insertionPoint = html.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
                    if (insertionPoint < 0)
                    {
                        _logger.LogWarning("Maarfin skipped UI injection because the Jellyfin web index has no closing head tag.");
                        buffer.Position = 0;
                        await buffer.CopyToAsync(originalBody, context.RequestAborted).ConfigureAwait(false);
                        return;
                    }

                    var updatedHtml = html.Insert(insertionPoint, Environment.NewLine + InjectionMarkup + Environment.NewLine);
                    var updatedBytes = Encoding.UTF8.GetBytes(updatedHtml);
                    response.ContentLength = updatedBytes.Length;
                    response.Headers["Cache-Control"] = "no-cache";
                    response.Headers.Remove("ETag");
                    await originalBody.WriteAsync(updatedBytes, context.RequestAborted).ConfigureAwait(false);
                    _logger.LogInformation("Injected Maarfin theme assets into Jellyfin Web at {Path}.", path);
                }
                finally
                {
                    response.Body = originalBody;
                    RestoreHeader(request.Headers, "Accept-Encoding", hadAcceptEncoding, acceptEncoding);
                    RestoreHeader(request.Headers, "If-None-Match", hadIfNoneMatch, ifNoneMatch);
                    RestoreHeader(request.Headers, "If-Modified-Since", hadIfModifiedSince, ifModifiedSince);
                }
            });

            next(app);
        };
    }

    private static bool IsJellyfinWebEntryPath(string? path)
    {
        return path is not null
            && (path.EndsWith("/web/index.html", StringComparison.OrdinalIgnoreCase)
                || path.Equals("/web", StringComparison.OrdinalIgnoreCase)
                || path.EndsWith("/web/", StringComparison.OrdinalIgnoreCase));
    }

    private static void RestoreHeader(
        IHeaderDictionary headers,
        string name,
        bool existed,
        StringValues value)
    {
        if (existed)
        {
            headers[name] = value;
        }
        else
        {
            headers.Remove(name);
        }
    }
}
