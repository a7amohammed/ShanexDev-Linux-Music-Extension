#!/usr/bin/env bash
set -euo pipefail

UUID="music-ext@mohammedsoliman"
SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
DATA_HOME="${XDG_DATA_HOME:-${HOME:?HOME must be set}/.local/share}"
EXTENSIONS_DIR="${DATA_HOME}/gnome-shell/extensions"
INSTALL_DIR="${EXTENSIONS_DIR}/${UUID}"
ENABLE=false

usage() {
    cat <<EOF
Usage: bash install.sh [--enable]

Install this extension to:
  ${INSTALL_DIR}

Options:
  --enable  Also enable the extension after installation
  -h, --help  Show this help
EOF
}

while (($#)); do
    case "$1" in
        --enable)
            ENABLE=true
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            printf 'Unknown option: %s\n' "$1" >&2
            usage >&2
            exit 2
            ;;
    esac
    shift
done

if [[ ! -f "${SOURCE_DIR}/metadata.json" ]]; then
    printf 'Cannot find metadata.json next to this installer.\n' >&2
    exit 1
fi

if ! command -v glib-compile-schemas >/dev/null 2>&1; then
    printf 'Missing glib-compile-schemas. Install GLib before installing this extension.\n' >&2
    exit 1
fi

mkdir -p -- "${INSTALL_DIR}"
for file in metadata.json extension.js stylesheet.css mpris.js ui.js lyrics.js search.js queue.js library.js ytmusic_helper.py; do
    if [[ ! -f "${SOURCE_DIR}/${file}" ]]; then
        printf 'Required extension file is missing: %s\n' "${file}" >&2
        exit 1
    fi
    cp -- "${SOURCE_DIR}/${file}" "${INSTALL_DIR}/${file}"
done

if [[ -d "${SOURCE_DIR}/schemas" ]]; then
    mkdir -p -- "${INSTALL_DIR}/schemas"
    cp -- "${SOURCE_DIR}/schemas/"*.gschema.xml "${INSTALL_DIR}/schemas/"
    glib-compile-schemas --strict "${INSTALL_DIR}/schemas"
fi

printf 'Installed %s to %s\n' "${UUID}" "${INSTALL_DIR}"

if [[ "${ENABLE}" == true ]]; then
    if ! command -v gnome-extensions >/dev/null 2>&1; then
        printf 'Installed, but gnome-extensions is unavailable; enable it later with:\n  gnome-extensions enable %s\n' "${UUID}" >&2
        exit 1
    fi
    gnome-extensions enable "${UUID}"
    printf 'Enabled %s\n' "${UUID}"
fi
