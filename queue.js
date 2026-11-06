export class PlaybackQueue {
    constructor() {
        this._items = [];
        this._index = -1;
    }

    add(item) {
        if (!item)
            return null;
        this._items.push(item);
        return item;
    }

    next() {
        if (this._items.length === 0)
            return null;
        this._index = (this._index + 1) % this._items.length;
        return this._items[this._index];
    }

    clear() {
        this._items = [];
        this._index = -1;
    }

    list() {
        return this._items.slice();
    }
}
