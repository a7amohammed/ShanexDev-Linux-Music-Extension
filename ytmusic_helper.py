#!/usr/bin/env python3

import argparse
import json
import os
import sys

try:
    import ytmusicapi  # type: ignore
except Exception as exc:  # pragma: no cover
    print(json.dumps({"error": f"ytmusicapi is not installed or failed to import: {exc}"}))
    sys.exit(1)


def main() -> int:
    parser = argparse.ArgumentParser(description='Read a YouTube Music library section')
    parser.add_argument('--section', choices=['playlists', 'liked', 'albums', 'tracks'], default='playlists')
    args = parser.parse_args()

    config_dir = os.path.join(os.path.expanduser('~'), '.config', 'floating-music')
    os.makedirs(config_dir, exist_ok=True)

    try:
        yt = ytmusicapi.YTMusic('headers_auth=~/.config/floating-music/headers_auth.json')
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"error": f"YouTube Music authentication is required: {exc}"}))
        return 1

    try:
        if args.section == 'playlists':
            payload = yt.get_library_playlists()
        elif args.section == 'liked':
            payload = yt.get_liked_songs()
        elif args.section == 'albums':
            payload = yt.get_library_albums()
        else:
            payload = yt.get_library_songs()
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"error": f"Unable to fetch section '{args.section}': {exc}"}))
        return 1

    print(json.dumps({"section": args.section, "items": payload[:20]}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
