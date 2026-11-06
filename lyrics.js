import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

const USER_AGENT = 'FloatingMusic/1.0 (GNOME Shell 51; libsoup 3)';

export class LyricsController {
    constructor() {
        this._session = null;
        this._cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'floating-music', 'lyrics']);
        this._cancellable = new Gio.Cancellable();
        this._pending = null;
    }

    load(track, callback) {
        const title = (track && track.title) || 'unknown';
        const artist = (track && track.artist) || '';
        const cachePath = this._cachePath(title, artist);

        const onData = payload => {
            if (typeof callback === 'function')
                callback(payload);
        };

        if (this._readCache(cachePath, onData))
            return;

        this._fetchLyrics(track, cachePath, onData);
    }

    cancel() {
        if (this._pending)
            this._pending.cancel();
        this._pending = null;
        this._cancellable.cancel();
        this._cancellable.reset();
    }

    destroy() {
        this.cancel();
        if (this._session)
            this._session = null;
    }

    _cachePath(title, artist) {
        const seed = `${title}-${artist}`.replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase();
        return GLib.build_filenamev([this._cacheDir, `${seed}.json`]);
    }

    _readCache(path, onData) {
        if (!GLib.file_test(path, GLib.FileTest.EXISTS))
            return false;

        try {
            const [ok, bytes] = GLib.file_get_contents(path);
            if (!ok)
                return false;
            const text = new TextDecoder().decode(bytes);
            const payload = JSON.parse(text);
            onData(payload);
            return true;
        } catch (error) {
            return false;
        }
    }

    _saveCache(path, payload) {
        try {
            const dir = this._cacheDir;
            if (!GLib.file_test(dir, GLib.FileTest.EXISTS))
                GLib.mkdir_with_parents(dir, 0o755);
            const text = JSON.stringify(payload, null, 2);
            GLib.file_set_contents(path, text);
        } catch (error) {
            console.warn(`[Lyrics] Could not cache lyrics: ${String(error)}`);
        }
    }

    _fetchLyrics(track, cachePath, onData) {
        if (!track || !track.title)
            onData({error: 'No track title available'});

        const title = encodeURIComponent(track.title || '');
        const artist = encodeURIComponent(track.artist || '');
        const url = `https://lrclib.net/api/search?track_name=${title}${artist ? `&artist_name=${artist}` : ''}`;

        if (!this._session)
            this._session = new Soup.Session();

        const message = Soup.Message.new('GET', url);
        message.request_headers.append('User-Agent', USER_AGENT);

        this._pending = this._session;
        this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, this._cancellable, (session, result) => {
            try {
                const bytes = session.send_and_read_finish(result);
                if (!bytes)
                    throw new Error('Empty response');

                const payload = JSON.parse(new TextDecoder().decode(bytes.get_data()));
                const item = Array.isArray(payload) ? payload[0] : payload;
                if (item && (item.syncedLyrics || item.plainLyrics)) {
                    const data = {
                        lines: this._parseLrc(item.syncedLyrics || item.plainLyrics || ''),
                        syncedLyrics: item.syncedLyrics || '',
                        plainLyrics: item.plainLyrics || '',
                    };
                    this._saveCache(cachePath, data);
                    onData(data);
                    return;
                }
                onData({message: 'No lyrics found'});
            } catch (error) {
                onData({message: 'No lyrics found'});
            }
        });
    }

    _parseLrc(text) {
        if (!text)
            return [];

        const lines = [];
        const re = /\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\]\s*(.*)/g;
        let match;
        while ((match = re.exec(text)) !== null) {
            const minutes = Number(match[1]);
            const seconds = Number(match[2]);
            const ms = Number(match[3] || '0');
            const time = minutes * 60 + seconds + (ms / 1000);
            lines.push({time, text: match[4] || ''});
        }

        if (lines.length === 0)
            return [{time: 0, text: text.trim()}];

        return lines;
    }
}
