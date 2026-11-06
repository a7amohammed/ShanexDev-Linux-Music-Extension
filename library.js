import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const HELPER = GLib.build_filenamev([GLib.get_current_dir(), 'ytmusic_helper.py']);

export class YoutubeMusicLibrary {
    constructor({onData, onError, onStatus}) {
        this._onData = onData || (() => {});
        this._onError = onError || (() => {});
        this._onStatus = onStatus || (() => {});
        this._process = null;
    }

    load(section) {
        const safeSection = String(section || 'playlists');
        this._onStatus(`Loading ${safeSection}`);
        const argv = ['python3', HELPER, '--section', safeSection];

        this._process?.send_signal(15, null);
        this._process = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

        this._process.communicate_utf8_async(null, null, (proc, res) => {
            try {
                const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                const errText = stderr || '';
                if (proc.get_if_exited() && proc.get_exit_status() !== 0) {
                    this._onError(errText || 'YouTube Music library is unavailable');
                    return;
                }
                const payload = JSON.parse(stdout || '{}');
                if (payload.error)
                    this._onError(payload.error);
                else
                    this._onData(payload);
            } catch (error) {
                this._onError(String(error));
            }
        });
    }

    cancel() {
        if (this._process)
            this._process.send_signal(15, null);
        this._process = null;
    }

    destroy() {
        this.cancel();
    }
}
