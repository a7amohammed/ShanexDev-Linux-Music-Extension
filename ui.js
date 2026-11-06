import Clutter from 'gi://Clutter';
import St from 'gi://St';

export class MusicWidget {
    constructor({onAction, onView}) {
        this._onAction = onAction || (() => {});
        this._onView = onView || (() => {});
        this._visible = true;
        this._currentView = null;
        this._viewActor = null;
        this._state = {};

        this.actor = new St.Widget({
            style_class: 'floating-music-panel',
            reactive: true,
            x_expand: false,
            y_expand: false,
            visible: true,
        });

        this.actor.set_size(440, 620);
        this.actor.set_style('background-color: rgba(14, 16, 20, 0.76);');

        this._box = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            style_class: 'floating-music-box',
        });
        this.actor.add_child(this._box);

        this._header = new St.BoxLayout({
            style_class: 'floating-music-header',
        });
        this._box.add_child(this._header);

        this._playerSelector = new St.Button({
            label: 'MPRIS',
            style_class: 'floating-music-player-button',
        });
        this._playerSelector.connect('clicked', () => this._onAction({type: 'select-player', busName: this._state.selectedBusName}));
        this._header.add_child(this._playerSelector);

        this._searchButton = new St.Button({
            label: 'Search',
            style_class: 'floating-music-search-button',
        });
        this._searchButton.connect('button-press-event', (actor, event) => {
            const button = event.get_button();
            if (button === 3)
                this._onView('library');
            else
                this._onView('search');
            return Clutter.EVENT_STOP;
        });
        this._header.add_child(this._searchButton);

        this._artWrap = new St.Widget({
            style_class: 'floating-music-art-wrap',
            reactive: true,
        });
        this._box.add_child(this._artWrap);

        this._disc = new St.Widget({
            style_class: 'floating-music-disc',
            reactive: true,
        });
        this._artWrap.add_child(this._disc);

        this._tonearm = new St.Widget({
            style_class: 'floating-music-tonearm',
        });
        this._artWrap.add_child(this._tonearm);

        this._disc.connect('button-press-event', (actor, event) => {
            if (event.get_button() === 1) {
                this._onView(this._currentView === 'lyrics' ? 'close' : 'lyrics');
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._disc.connect('scroll-event', (_actor, event) => {
            const direction = event.get_scroll_direction();
            if (direction === Clutter.ScrollDirection.UP)
                this._onAction({type: 'volume', delta: 0.05});
            else if (direction === Clutter.ScrollDirection.DOWN)
                this._onAction({type: 'volume', delta: -0.05});
            return Clutter.EVENT_STOP;
        });

        this._meta = new St.BoxLayout({
            vertical: true,
            style_class: 'floating-music-meta',
        });
        this._box.add_child(this._meta);

        this._title = new St.Label({
            text: 'No track selected',
            style_class: 'floating-music-title',
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._meta.add_child(this._title);

        this._artist = new St.Label({
            text: 'Waiting for a player',
            style_class: 'floating-music-artist',
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._meta.add_child(this._artist);

        this._timeRow = new St.BoxLayout({
            style_class: 'floating-music-timerow',
        });
        this._box.add_child(this._timeRow);

        this._elapsed = new St.Label({
            text: '0:00',
            style_class: 'floating-music-time',
        });
        this._timeRow.add_child(this._elapsed);

        this._progress = new St.ProgressBar({
            style_class: 'floating-music-progress',
            value: 0.0,
            x_expand: true,
        });
        this._progress.connect('button-press-event', (actor, event) => {
            const [x,] = event.get_coords();
            const [width] = actor.get_size();
            const percent = Math.max(0, Math.min(1, (x - actor.get_x()) / Math.max(width, 1)));
            this._onAction({type: 'seek', seconds: percent * (this._state.duration || 0) / 1000000});
            return Clutter.EVENT_STOP;
        });
        this._timeRow.add_child(this._progress);

        this._total = new St.Label({
            text: '0:00',
            style_class: 'floating-music-time',
        });
        this._timeRow.add_child(this._total);

        this._controls = new St.BoxLayout({
            style_class: 'floating-music-controls',
        });
        this._box.add_child(this._controls);

        this._shuffle = this._makeControl('Shuffle', 'shuffle');
        this._controls.add_child(this._shuffle);

        this._prev = this._makeControl('Prev', 'previous');
        this._controls.add_child(this._prev);

        this._playPause = this._makeControl('Play', 'play-pause', true, 'primary');
        this._controls.add_child(this._playPause);

        this._next = this._makeControl('Next', 'next');
        this._controls.add_child(this._next);

        this._repeat = this._makeControl('Repeat', 'repeat');
        this._controls.add_child(this._repeat);

        this._statusLabel = new St.Label({
            text: '',
            style_class: 'floating-music-status',
        });
        this._box.add_child(this._statusLabel);
    }

    _makeControl(label, actionType, prominent = false, variant = '') {
        const button = new St.Button({
            label,
            style_class: prominent ? 'floating-music-control primary' : 'floating-music-control',
        });
        button.connect('clicked', () => this._onAction({type: actionType, active: button.get_checked ? button.checked : false}));
        return button;
    }

    setVisible(visible) {
        this._visible = visible;
        this.actor.visible = visible;
        if (!visible)
            this.closeView();
    }

    setState(state) {
        this._state = state || {};

        const title = state.title || 'No track selected';
        const artist = state.artist || 'Waiting for a player';
        const durationUs = Number(state.duration || 0);
        const positionUs = Number(state.position || 0);
        const isPlaying = String(state.playbackStatus || '').toLowerCase() === 'playing';
        const volume = Number(state.volume || 0);

        this._title.text = title;
        this._artist.text = artist;
        this._elapsed.text = this._formatTime(positionUs / 1000000);
        this._total.text = this._formatTime(durationUs / 1000000);
        this._progress.value = durationUs > 0 ? Math.min(1, positionUs / durationUs) : 0.0;
        this._playPause.label = isPlaying ? 'Pause' : 'Play';
        this._shuffle.add_style_pseudo_class('checked');
        this._repeat.add_style_pseudo_class('checked');

        this.actor.add_style_class_name(isPlaying ? 'is-playing' : 'is-paused');
        this._disc.add_style_class_name(isPlaying ? 'rotating' : 'stopped');
        this._tonearm.add_style_class_name(isPlaying ? 'playing' : 'paused');

        const players = state.players || [];
        if (players.length > 0) {
            const selected = players.find(p => p.busName === state.selectedBusName) || players[0];
            this._playerSelector.label = selected ? selected.name : 'MPRIS';
        }

        if (this._statusLabel)
            this._statusLabel.text = volume > 0 ? `Volume ${volume.toFixed(2)}` : 'Muted';
    }

    showView(name, data) {
        this._currentView = name;
        if (this._viewActor)
            this._viewActor.destroy();

        this._viewActor = new St.BoxLayout({
            vertical: true,
            style_class: 'floating-music-view',
            visible: true,
        });
        this.actor.add_child(this._viewActor);

        const label = new St.Label({
            text: name === 'lyrics' ? 'Lyrics' : name === 'search' ? 'Search' : 'Library',
            style_class: 'floating-music-view-title',
        });
        this._viewActor.add_child(label);

        if (data && data.message)
            this._viewActor.add_child(new St.Label({text: data.message, style_class: 'floating-music-view-message'}));
        else if (data && data.loading)
            this._viewActor.add_child(new St.Label({text: 'Loading…', style_class: 'floating-music-view-message'}));
        else if (data && data.results)
            this._renderSearchResults(data.results);
        else if (data && data.lines)
            this._renderLyrics(data.lines);

        if (this._viewActor)
            this.actor.set_child_above_sibling(this._viewActor, this._box);
    }

    updateView(data) {
        if (!this._viewActor)
            return;
        if (data && data.error) {
            const label = new St.Label({text: data.error, style_class: 'floating-music-view-message'});
            this._viewActor.add_child(label);
            return;
        }
        if (data && data.results) {
            this._renderSearchResults(data.results);
            return;
        }
        if (data && data.lines) {
            this._renderLyrics(data.lines);
            return;
        }
        if (data && data.message) {
            const label = new St.Label({text: data.message, style_class: 'floating-music-view-message'});
            this._viewActor.add_child(label);
        }
    }

    closeView() {
        if (this._viewActor) {
            this._viewActor.destroy();
            this._viewActor = null;
        }
        this._currentView = null;
    }

    destroy() {
        this.closeView();
        this.actor.destroy();
    }

    _renderSearchResults(results) {
        if (!this._viewActor)
            return;
        const list = new St.BoxLayout({vertical: true, style_class: 'floating-music-results'});
        for (const result of results || []) {
            const item = new St.Button({
                label: `${result.title || 'Untitled'} — ${result.artist || 'Unknown artist'}`,
                style_class: 'floating-music-result',
            });
            item.connect('clicked', () => this._onAction({type: 'play-result', result}));
            list.add_child(item);
        }
        this._viewActor.add_child(list);
    }

    _renderLyrics(lines) {
        if (!this._viewActor)
            return;
        const scroll = new St.ScrollView({
            style_class: 'floating-music-lyrics-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
        });
        const box = new St.BoxLayout({vertical: true, style_class: 'floating-music-lyrics'});
        for (const line of lines || []) {
            const label = new St.Label({
                text: line.text || ' ',
                style_class: 'floating-music-lyric-line',
            });
            box.add_child(label);
        }
        scroll.add_child(box);
        this._viewActor.add_child(scroll);
    }

    _formatTime(seconds) {
        const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
        const mins = Math.floor(safe / 60);
        const secs = Math.floor(safe % 60);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }
}
