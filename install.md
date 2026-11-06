# Install and Test Guide

This guide shows how to install the floating music GNOME Shell extension in a local GNOME 51 environment and test it safely.

## 1. Install the extension

From the project directory, run:

```bash
bash install.sh
```

To install and enable it immediately:

```bash
bash install.sh --enable
```

The script installs the extension under its UUID and compiles the GSettings schema. It does not install system packages.

To install manually, copy or symlink the project into GNOME Shell's extension folder:

From the project directory, copy or symlink the extension into GNOME Shell's extension folder:

```bash
mkdir -p ~/.local/share/gnome-shell/extensions
cp -a /home/mohammed/Projects/Gnome-ext-music ~/.local/share/gnome-shell/extensions/music-ext@mohammedsoliman
```

If you prefer a symlink instead of a copy:

```bash
ln -s /home/mohammed/Projects/Gnome-ext-music ~/.local/share/gnome-shell/extensions/music-ext@mohammedsoliman
```

## 2. Install required tools

Optional but recommended for the full experience:

```bash
sudo pacman -S --needed gnome-shell python python-pip yt-dlp mpv libsoup3
python3 -m venv ~/.venvs/ytmusic
~/.venvs/ytmusic/bin/pip install ytmusicapi
```

If you use Debian/Ubuntu:

```bash
sudo apt install gnome-shell python3 python3-pip yt-dlp mpv libsoup-3.0-0
python3 -m venv ~/.venvs/ytmusic
~/.venvs/ytmusic/bin/pip install ytmusicapi
```

If you use Fedora:

```bash
dnf install gnome-shell python3 python3-pip yt-dlp mpv libsoup
python3 -m venv ~/.venvs/ytmusic
~/.venvs/ytmusic/bin/pip install ytmusicapi
```

## 3. Enable the extension

```bash
gnome-extensions enable music-ext@mohammedsoliman
```

## 4. Test in a safe GNOME Shell session

Use a dev session so you can debug without breaking the main desktop session:

```bash
dbus-run-session -- gnome-shell --devkit
```

## 5. Watch logs if something fails

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

## 6. Toggle the extension

Once GNOME Shell starts, use the status-area icon or the configured keybinding to open the floating widget.

## 7. Check MPRIS player detection

Start a media player that exposes org.mpris.MediaPlayer2.* (for example mpv or Spotify), then open the widget and verify that metadata appears.

## 8. Optional: configure YouTube Music

The helper expects a browser-auth headers file under:

```bash
~/.config/floating-music/
```

You can place the ytmusicapi headers export there if you want to use the library panel.

## 9. If the extension does not appear

Check the shell logs:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

Typical causes:
- wrong extension UUID/path
- missing gnome-shell runtime dependencies
- JS error during extension enable
- incompatible GNOME Shell version

## 10. Known limitation

This is a local extension scaffold and may need runtime tuning in an actual GNOME 51 desktop session.
