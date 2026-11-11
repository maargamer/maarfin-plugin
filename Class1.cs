using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using MyJellyfinPlugin.Configuration;

namespace MyJellyfinPlugin;

public sealed class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    private const string WebResourcePrefix = "MyJellyfinPlugin.Web";

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
    }

    public override string Name => "Maarfin";

    public IEnumerable<PluginPageInfo> GetPages()
    {
        yield return new PluginPageInfo
        {
            Name = "maarfin",
            DisplayName = "Maarfin",
            EmbeddedResourcePath = WebResourcePrefix + ".index.html",
            EnableInMainMenu = true,
            MenuSection = "home",
            MenuIcon = "palette"
        };

        yield return new PluginPageInfo
        {
            Name = "maarfin-logo.png",
            EmbeddedResourcePath = WebResourcePrefix + ".logo.png"
        };

        yield return new PluginPageInfo
        {
            Name = "maarfin.js",
            EmbeddedResourcePath = WebResourcePrefix + ".maarfin.js"
        };

        yield return new PluginPageInfo
        {
            Name = "maarfin-global.js",
            EmbeddedResourcePath = WebResourcePrefix + ".maarfin-global.js"
        };

        yield return new PluginPageInfo
        {
            Name = "maarfin-theme.css",
            EmbeddedResourcePath = WebResourcePrefix + ".maarfin-theme.css"
        };
    }
}