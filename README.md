# Floating Music

A GNOME Shell 51 floating music player designed to stay lightweight and responsive. It focuses on a minimal UI with a circular vinyl album disc, a draggable panel, lyrics, search, and a simple local queue.

## Description

The extension is intentionally slim and uses a small number of lazy-loaded views. The main widget stays available while the panel is open, and the lyrics/search/library panes are created only when needed. The design tries to respect the memory budget and avoids embedding any browser or webview content.

## Features

- Floating semi-transparent player panel with rounded edges, soft shadow, and drag-friendly layout
- Circular vinyl disc art with center hole and tonearm animation while playback is active
- Title/artist metadata, time display, clickable seeking progress bar, and media controls
- Search entry and results for plain text, yt-dlp-supported URLs, playlists, local files, stream URLs, and folder paths
- MPRIS-based monitoring and control for standard media players including Spotify, browsers, mpv, and other player applications
- A lazy lyrics panel using LRCLIB as the primary source and a minimal local cache on disk
- A small YouTube Music library panel backed by an on-demand Python helper and ytmusicapi
- Keyboard shortcut toggle support via the schema key `toggle-player`

## Interaction notes

- Left-click the disc to toggle the lyrics view. Left-click again on the lyrics view to return to the player.
- Mouse wheel on the disc changes volume and briefly shows a small indicator through the status text.
- Left-click the Search button opens the search view; right-click on the same button opens the YouTube Music library panel.
- The same search box can receive plain text, URLs, local files, dropped files, or direct stream links.
- If an interaction conflicts with another request in a custom layout, the behavior above wins; the original request specifically notes the right-click library behavior as the intentional override for the search button.

## Requirements

- GNOME Shell 51+
- Python 3
- yt-dlp
- mpv and mpv-mpris (or a comparable MPRIS-aware mpv setup)
- ytmusicapi for the optional library feature
- libsoup 3 for lyrics loading
- Node.js/npm only for editor and type tooling, not as runtime requirements for the extension itself

## Installation

### Arch / EndeavourOS

1. Install the base packages:
   ```bash
   sudo pacman -S --needed gnome-shell python python-pip yt-dlp mpv
   sudo pacman -S --needed libsoup3
   ```
2. Create a virtual environment for the helper if you want the library feature:
   ```bash
   python3 -m venv ~/.venvs/ytmusic
   ~/.venvs/ytmusic/bin/pip install --upgrade pip ytmusicapi
   ```
3. Copy or symlink the extension into GNOME Shell's extension directory:
   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions
   cp -a /path/to/floating-music ~/.local/share/gnome-shell/extensions/music-ext@mohammedsoliman
   ```
4. Enable the extension:
   ```bash
   gnome-extensions enable music-ext@mohammedsoliman
   ```
5. Reload GNOME Shell or log out/in, then open the extension with the configured shortcut.

### Fedora

- Install the equivalents from dnf, then install `yt-dlp`, `mpv`, `python3`, and `libsoup3`, plus `python3-pip`.
- For ytmusicapi, use a virtual environment and pip install it there.

### Ubuntu / Debian

- Use `apt install` for `gnome-shell`, `python3`, `python3-pip`, `yt-dlp`, `mpv`, and `libsoup-3.0-0`.
- Use a virtual environment for `ytmusicapi` if you want the library panel.

## Extension install and testing

- Extension directory: `~/.local/share/gnome-shell/extensions/music-ext@mohammedsoliman`
- Enable it from the command line:
  ```bash
  gnome-extensions enable music-ext@mohammedsoliman
  ```
- Safe GNOME Shell test session:
  ```bash
  dbus-run-session -- gnome-shell --devkit
  ```
- Observe logs with:
  ```bash
  journalctl -f -o cat /usr/bin/gnome-shell
  ```

## YouTube Music authentication

1. Install ytmusicapi into a virtual environment.
2. Create a browser headers file in `~/.config/floating-music/headers_auth.json` using the same flow described by the upstream project.
3. The helper script reads that file automatically when the library pane is opened.
4. If authentication is missing, the library view shows a user-facing message telling you to install and configure ytmusicapi.
5. Do not hardcode credentials; keep everything in the local config directory.

## Memory usage

The extension's memory limit is treated as a hard requirement: keep the idle footprint under roughly 50 to 100 MB total, and ideally much lower. The design is intentionally conservative:

- no browser, WebKit, or Electron embedding
- lazy creation and destruction of lyrics, search, and library views
- small, on-demand cache usage for lyrics and thumbnail metadata
- minimal polling; prefer D-Bus property updates when possible
- no large in-memory caches

To measure it:

```bash
ps -o rss,comm -C gnome-shell
``` 
Then compare before and after opening a view while the debug switch is enabled. The extension schema includes the `debug-memory` switch for logging the shell RSS value before and after each view opens.

Important: `mpv` is a separate process with its own memory usage. It is not embedded in GNOME Shell and may use additional RAM while playing a search result.

## Troubleshooting

- If the player does not appear, check whether an MPRIS media player is currently active and whether the extension's MPRIS scan can see it.
- If `yt-dlp` or `ytmusicapi` fails, install the tools in the environment that GNOME Shell is running under.
- If the library pane shows a missing dependency message, install `ytmusicapi` in a virtualenv and confirm the helper script can import it.
- If lyrics are empty, the LRCLIB endpoint may not have a match; the UI will show a friendly empty-state message instead.
- If the extension does not update metadata, the selected player may not expose proper MPRIS properties.

## Known limitations

- The unofficial ytmusicapi and yt-dlp tools can change behavior or break on upstream changes.
- The extension is intentionally lightweight and does not try to embed user accounts or paid third-party services.
- Some local media sources and stream URLs require the underlying player backend to support them correctly.
- Only the core free and open-source workflow is guaranteed.

## License

This project is a simple personal GNOME Shell extension skeleton, intended to be customized and redistributed under the terms of your local project license.
