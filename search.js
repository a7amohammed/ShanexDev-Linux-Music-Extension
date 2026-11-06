import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class SearchController {
    constructor({onResults, onError, onStatus}) {
        this._onResults = onResults || (() => {});
        this._onError = onError || (() => {});
        this._onStatus = onStatus || (() => {});
        this._process = null;
        this._debounceId = 0;
        this._currentQuery = '';
    }

    search(query) {
        const text = String(query || '').trim();
        this._currentQuery = text;
        if (!text) {
            this._onResults([]);
            return;
        }

        if (this._debounceId !== 0)
            GLib.source_remove(this._debounceId);

        this._debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._debounceId = 0;
            this._runSearch(text);
            return GLib.SOURCE_REMOVE;
        });
    }

    cancel() {
        if (this._debounceId)
            GLib.source_remove(this._debounceId);
        this._debounceId = 0;
        if (this._process)
            this._process.send_signal(15, null);
        this._process = null;
    }

    destroy() {
        this.cancel();
    }

    play(result) {
        if (!result)
            return;
        const url = result.url || result.webpage_url || result.link || result.uri || '';
        if (!url)
            return;

        this._onStatus(`Launching mpv for ${result.title || 'selection'}`);
        const argv = ['mpv', '--no-video', '--idle=no', '--cache=yes', '--cache-secs=20', url];
        this._process = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    }

    _runSearch(text) {
        if (this._process)
            this._process.send_signal(15, null);

        const argv = ['yt-dlp', '--flat-playlist', '--dump-single-json', `ytsearch10:${text}`];
        this._process = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        this._process.communicate_utf8_async(null, null, (proc, res) => {
            try {
                const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                const out = stdout || '';
                const err = stderr || '';
                if (proc.get_if_exited() && proc.get_exit_status() !== 0) {
                    this._onError(err || 'Search failed');
                    return;
                }

                const payload = JSON.parse(out);
                const results = Array.isArray(payload.entries) ? payload.entries : [payload];
                this._onResults(results.map(item => ({
                    title: item.title || 'Unknown title',
                    artist: item.uploader || item.artist || 'Unknown artist',
                    url: item.url || item.webpage_url || item.link || '',
                    thumbnail: item.thumbnail || '',
                })));
            } catch (error) {
                this._onError(String(error));
            }
        });
    }
}
