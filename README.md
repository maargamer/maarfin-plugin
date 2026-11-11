# Maarfin

Maarfin is a Jellyfin plugin that adds an optional visual theme to Jellyfin Web and a custom media home page.

## Requirements

- Jellyfin Server 10.11.5
- .NET 9 SDK to build

The theme applies to Jellyfin Web and clients that embed Jellyfin Web. Native TV interfaces are not affected.

## Build

```powershell
dotnet restore
dotnet build .\MyJellyfinPlugin.csproj -c Release
```

The plugin assembly is created at `bin\Release\net9.0\MyJellyfinPlugin.dll`.

## Install manually on Windows

1. Stop Jellyfin Server.
2. Create a `Maarfin_1.0.0.0` folder in the Jellyfin plugins directory:
   - Standard install: `%ProgramData%\Jellyfin\Server\plugins`
   - Direct install: `%LOCALAPPDATA%\jellyfin\plugins`
3. Copy `MyJellyfinPlugin.dll` into that folder.
4. Start Jellyfin Server and hard-refresh Jellyfin Web.

## Development

After changing the code or web assets, rebuild the plugin, replace the DLL in the plugins folder, restart Jellyfin, and hard-refresh the browser.
