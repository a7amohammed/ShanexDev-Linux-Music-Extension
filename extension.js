import GLib from 'gi://GLib';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {MprisController} from './mpris.js';
import {MusicWidget} from './ui.js';
import {LyricsController} from './lyrics.js';
import {SearchController} from './search.js';
import {PlaybackQueue} from './queue.js';
import {YoutubeMusicLibrary} from './library.js';

export default class FloatingMusicExtension extends Extension {
    enable() {
        this._enabled = true;
        this._activeView = null;
        this._state = {};
        this._lyrics = null;
        this._search = null;
        this._library = null;
        this._queue = new PlaybackQueue();

        this._settings = this.getSettings();
        this._widget = new MusicWidget({
            onAction: action => this._onAction(action),
            onView: view => this._onView(view),
        });

        Main.layoutManager.addChrome(this._widget.actor, {trackFullscreen: true});
        this._widget.actor.hide();

        this._panelButton = new PanelMenu.Button(0.0, 'Floating Music', false);
        this._panelButton.add_child(new St.Icon({
            icon_name: 'audio-x-generic-symbolic',
            style_class: 'system-status-icon',
        }));
        this._panelButton.connect('clicked', () => this._togglePlayer());
        Main.panel.addToStatusArea(this.uuid, this._panelButton);

        this._mpris = new MprisController(state => this._onPlayerState(state));
        this._mpris.start();
        this._registerKeybinding();
    }

    disable() {
        this._enabled = false;
        this._unregisterKeybinding();

        this._lyrics?.destroy();
        this._lyrics = null;
        this._search?.destroy();
        this._search = null;
        this._library?.destroy();
        this._library = null;

        this._mpris?.stop();
        this._mpris = null;
        this._queue?.clear();
        this._queue = null;

        if (this._widget) {
            this._widget.setVisible(false);
            this._widget.destroy();
            Main.layoutManager.removeChrome(this._widget.actor);
            this._widget = null;
        }
        this._panelButton?.destroy();
        this._panelButton = null;
        this._settings = null;
        this._activeView = null;
    }

    _registerKeybinding() {
        Main.wm.addKeybinding(
            'toggle-player',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            () => this._togglePlayer()
        );
    }

    _unregisterKeybinding() {
        Main.wm.removeKeybinding('toggle-player');
    }

    _togglePlayer() {
        if (!this._widget)
            return;

        const visible = !this._widget.actor.visible;
        if (!visible)
            this._closeView();
        this._widget.actor.visible = visible;
        this._widget.setVisible(visible);
        this._mpris?.setVisible(visible);

        if (visible)
            this._positionWidget();
    }

    _positionWidget() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor || !this._widget)
            return;

        const [width, height] = this._widget.actor.get_size();
        this._widget.actor.set_position(
            Math.round(monitor.x + (monitor.width - width) / 2),
            Math.round(monitor.y + (monitor.height - height) / 2)
        );
    }

    _onPlayerState(state) {
        if (!this._enabled || !this._widget)
            return;

        const previousStatus = this._state.playbackStatus;
        this._state = state ?? {};
        const players = this._mpris?.getPlayers?.() ?? [];
        this._widget.setState({...this._state, players});

        if (previousStatus === 'Playing' && this._state.playbackStatus === 'Stopped') {
            const queued = this._queue?.next();
            if (queued)
                this._getSearchController().play(queued);
        }

        if (this._activeView === 'lyrics')
            this._loadLyricsForCurrentTrack();
    }

    _onView(view) {
        if (!this._enabled)
            return;
        if (view === 'close') {
            this._closeView();
            return;
        }
        if (!['lyrics', 'search', 'library'].includes(view))
            return;

        if (this._activeView === view) {
            this._closeView();
            return;
        }

        this._closeView();
        this._activeView = view;
        this._logMemory(`${view} before`);

        if (view === 'lyrics') {
            this._lyrics ??= new LyricsController();
            this._widget.showView('lyrics', {loading: true});
            this._loadLyricsForCurrentTrack();
        } else if (view === 'search') {
            this._widget.showView('search', {loading: false, results: []});
            this._getSearchController();
        } else {
            this._library ??= new YoutubeMusicLibrary({
                onData: data => {
                    if (this._enabled && this._activeView === 'library')
                        this._widget.updateView({loading: false, ...data});
                },
                onError: message => this._showViewError(message),
                onStatus: message => this._updateViewStatus(message),
            });
            this._widget.showView('library', {loading: true});
            this._library.load('playlists');
        }

        this._logMemory(`${view} after`);
    }

    _closeView() {
        if (!this._activeView)
            return;

        this._lyrics?.cancel();
        this._search?.cancel();
        this._library?.cancel();
        this._widget?.closeView();
        this._activeView = null;
    }

    _loadLyricsForCurrentTrack() {
        if (!this._lyrics || this._activeView !== 'lyrics')
            return;
        const metadata = this._state.metadata ?? {};
        const title = metadata.title ?? this._state.title ?? '';
        const artists = metadata.artists ?? this._state.artists ?? [];
        const artist = Array.isArray(artists) ? artists.join(', ') : artists;
        if (!title) {
            this._widget.updateView({loading: false, message: 'No track is playing.'});
            return;
        }

        this._lyrics.load({title, artist, album: metadata.album ?? this._state.album ?? ''}, data => {
            if (this._enabled && this._activeView === 'lyrics')
                this._widget.updateView({loading: false, ...data});
        });
    }

    _getSearchController() {
        if (!this._search) {
            this._search = new SearchController({
                onResults: results => {
                    if (this._enabled && this._activeView === 'search')
                        this._widget.updateView({loading: false, results});
                },
                onError: message => this._showViewError(message),
                onStatus: message => this._updateViewStatus(message),
            });
        }
        return this._search;
    }

    _onAction(action) {
        if (!this._enabled || !action)
            return;

        switch (action.type) {
        case 'play-pause':
            this._mpris?.command('playPause');
            break;
        case 'previous':
            this._mpris?.command('previous');
            break;
        case 'next':
            this._mpris?.command('next');
            break;
        case 'shuffle':
            this._mpris?.command('shuffle', action.active);
            break;
        case 'repeat':
            this._mpris?.command('repeat', action.active);
            break;
        case 'seek':
            this._mpris?.command('seek', action.seconds);
            break;
        case 'volume': {
            const current = Number(this._state.volume ?? 0);
            this._mpris?.setVolume(Math.max(0, Math.min(1, current + Number(action.delta ?? 0))));
            break;
        }
        case 'search-query':
            if (this._activeView === 'search')
                this._getSearchController().search(action.query);
            break;
        case 'play-result':
            this._getSearchController().play(action.result);
            break;
        case 'queue-result':
            this._queue?.add(action.result);
            break;
        case 'select-player':
            this._mpris?.selectPlayer(action.busName);
            break;
        case 'library-section':
            if (this._activeView === 'library')
                this._library?.load(action.section);
            break;
        case 'library-play':
            this._getSearchController().play(action.result);
            break;
        }
    }

    _showViewError(message) {
        if (this._enabled && this._activeView)
            this._widget.updateView({loading: false, error: String(message)});
    }

    _updateViewStatus(message) {
        if (this._enabled && this._activeView)
            this._widget.updateView({status: String(message)});
    }

    _logMemory(label) {
        if (!this._settings?.get_boolean('debug-memory'))
            return;

        try {
            const [ok, contents] = GLib.file_get_contents('/proc/self/status');
            if (!ok)
                throw new Error('Unable to read /proc/self/status');
            const status = new TextDecoder().decode(contents);
            const rss = status.match(/^VmRSS:\s+(.+)$/m)?.[1]?.trim() ?? 'unavailable';
            console.log(`[Floating Music] Shell RSS ${label}: ${rss}`);
        } catch (error) {
            console.warn(`[Floating Music] Could not log Shell RSS: ${error.message}`);
        }
    }
}
