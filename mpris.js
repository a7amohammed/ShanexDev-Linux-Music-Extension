import Gio from 'gi://Gio';

const MPRIS2_IFACE = `
<node>
  <interface name='org.mpris.MediaPlayer2'>
    <property name='CanQuit' type='b' access='read' />
    <property name='CanRaise' type='b' access='read' />
    <property name='DesktopEntry' type='s' access='read' />
    <property name='HasTrackList' type='b' access='read' />
    <property name='Identity' type='s' access='read' />
    <property name='SupportedMimeTypes' type='as' access='read' />
    <property name='SupportedUriSchemes' type='as' access='read' />
    <method name='Raise' />
    <method name='Quit' />
  </interface>
  <interface name='org.mpris.MediaPlayer2.Player'>
    <property name='PlaybackStatus' type='s' access='read' />
    <property name='LoopStatus' type='s' access='readwrite' />
    <property name='Rate' type='d' access='readwrite' />
    <property name='Shuffle' type='b' access='readwrite' />
    <property name='Metadata' type='a{sv}' access='read' />
    <property name='Volume' type='d' access='readwrite' />
    <property name='Position' type='x' access='read' />
    <property name='MinimumRate' type='d' access='read' />
    <property name='MaximumRate' type='d' access='read' />
    <property name='CanGoNext' type='b' access='read' />
    <property name='CanGoPrevious' type='b' access='read' />
    <property name='CanPlay' type='b' access='read' />
    <property name='CanPause' type='b' access='read' />
    <property name='CanSeek' type='b' access='read' />
    <property name='CanControl' type='b' access='read' />
    <method name='Next' />
    <method name='Previous' />
    <method name='Pause' />
    <method name='PlayPause' />
    <method name='Stop' />
    <method name='Play' />
    <method name='Seek'><arg type='x' name='Offset' direction='in' /></method>
    <method name='SetPosition'><arg type='o' name='TrackId' direction='in' /><arg type='x' name='Position' direction='in' /></method>
    <method name='OpenUri'><arg type='s' name='Uri' direction='in' /></method>
  </interface>
</node>`;

const PlayerProxy = Gio.DBusProxy.makeProxyWrapper(MPRIS2_IFACE);

export class MprisController {
    constructor(onStateChanged) {
        this._onStateChanged = onStateChanged || (() => {});
        this._players = [];
        this._selectedBusName = null;
        this._proxy = null;
        this._signals = [];
        this._visible = false;
        this._pollId = 0;
        this._state = {
            playbackStatus: 'Stopped',
            title: '',
            artist: '',
            album: '',
            volume: 0.0,
            position: 0,
            duration: 0,
            playbackStatus: 'Stopped',
            shuffle: false,
            loopStatus: 'None',
            players: [],
            metadata: {},
        };
    }

    start() {
        this._discoverPlayers();
        if (this._pollId === 0)
            this._pollId = globalThis.setInterval(() => this._refreshSelectedPlayer(), 1000);
    }

    stop() {
        if (this._pollId !== 0) {
            globalThis.clearInterval(this._pollId);
            this._pollId = 0;
        }
        for (const signal of this._signals)
            signal.disconnect();
        this._signals = [];

        if (this._proxy) {
            this._proxy.disconnectAll();
            this._proxy = null;
        }

        this._players = [];
        this._selectedBusName = null;
    }

    setVisible(visible) {
        this._visible = visible;
        if (visible)
            this._refreshSelectedPlayer();
    }

    getPlayers() {
        return this._players.slice();
    }

    getState() {
        return this._state;
    }

    selectPlayer(busName) {
        if (!busName)
            return;
        this._selectedBusName = busName;
        this._connectProxy(busName);
        this._refreshSelectedPlayer();
    }

    command(action, value) {
        const proxy = this._proxy;
        if (!proxy)
            return;

        switch (action) {
        case 'playPause':
            if (typeof proxy.PlayPause === 'function')
                proxy.PlayPause();
            break;
        case 'play':
            if (typeof proxy.Play === 'function')
                proxy.Play();
            break;
        case 'pause':
            if (typeof proxy.Pause === 'function')
                proxy.Pause();
            break;
        case 'next':
            if (typeof proxy.Next === 'function')
                proxy.Next();
            break;
        case 'previous':
            if (typeof proxy.Previous === 'function')
                proxy.Previous();
            break;
        case 'seek':
            if (typeof proxy.Seek === 'function' && typeof value === 'number')
                proxy.Seek(Math.round(value * 1000000));
            break;
        case 'shuffle':
            if (typeof proxy.Shuffle !== 'undefined')
                proxy.Shuffle = !!value;
            break;
        case 'repeat':
            if (typeof proxy.LoopStatus !== 'undefined')
                proxy.LoopStatus = value === true ? 'Playlist' : 'None';
            break;
        default:
            break;
        }
    }

    setVolume(volume) {
        const proxy = this._proxy;
        if (!proxy)
            return;
        proxy.Volume = Math.max(0.0, Math.min(1.0, Number(volume) || 0.0));
        this._refreshSelectedPlayer();
    }

    _discoverPlayers() {
        Gio.DBus.session.call(
            'org.freedesktop.DBus',
            '/org/freedesktop/DBus',
            'org.freedesktop.DBus',
            'ListNames',
            null,
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (source, result) => {
                try {
                    const [out,] = source.call_finish(result);
                    const names = out.deep_unpack?.() ?? [];
                    const players = names.filter(name => name.includes('org.mpris.MediaPlayer2'));
                    this._players = players.map(name => ({
                        busName: name,
                        name: name.replace(/^org\.mpris\.MediaPlayer2\./, ''),
                    }));
                    if (!this._selectedBusName && this._players.length > 0)
                        this._selectedBusName = this._players[0].busName;
                    this._connectProxy(this._selectedBusName);
                    this._refreshSelectedPlayer();
                    this._emitState();
                } catch (error) {
                    console.warn(`[MPRIS] ${String(error)}`);
                }
            }
        );
    }

    _connectProxy(busName) {
        if (!busName)
            return;

        if (this._proxy && this._proxy.g_name_owner === busName)
            return;

        if (this._proxy) {
            for (const signal of this._signals)
                signal.disconnect();
            this._signals = [];
            this._proxy = null;
        }

        try {
            this._proxy = new PlayerProxy(Gio.DBus.session, busName, '/org/mpris/MediaPlayer2');
            const proxy = this._proxy;
            this._signals.push(proxy.connect('g-properties-changed', () => this._refreshSelectedPlayer()));
            this._signals.push(proxy.connect('notify::PlaybackStatus', () => this._refreshSelectedPlayer()));
            this._signals.push(proxy.connect('notify::Metadata', () => this._refreshSelectedPlayer()));
            this._signals.push(proxy.connect('notify::Volume', () => this._refreshSelectedPlayer()));
        } catch (error) {
            console.warn(`[MPRIS] Could not connect to ${busName}: ${String(error)}`);
            this._proxy = null;
        }
    }

    _refreshSelectedPlayer() {
        const proxy = this._proxy;
        if (!proxy)
            return;

        let metadata = proxy.Metadata || {};
        if (typeof metadata === 'object' && metadata !== null) {
            const title = metadata['xesam:title'] || metadata['mpris:trackid'] || '';
            const artist = Array.isArray(metadata['xesam:artist']) ? metadata['xesam:artist'].join(', ') : (metadata['xesam:artist'] || '');
            const album = metadata['xesam:album'] || '';
            const artUrl = metadata['mpris:artUrl'] || '';
            const duration = Number(metadata['mpris:length'] || 0);

            this._state = {
                ...this._state,
                title,
                artist,
                album,
                artUrl,
                duration,
                metadata,
                playbackStatus: proxy.PlaybackStatus || 'Stopped',
                volume: Number(proxy.Volume ?? 0),
                position: Number(proxy.Position ?? 0),
                shuffle: !!proxy.Shuffle,
                loopStatus: proxy.LoopStatus || 'None',
                players: this._players,
            };
        }

        this._emitState();
    }

    _emitState() {
        const state = {
            ...this._state,
            players: this._players,
            selectedBusName: this._selectedBusName,
            playbackStatus: this._state.playbackStatus || 'Stopped',
        };
        this._onStateChanged(state);
    }
}
