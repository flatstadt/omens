import { from, Observable, queueScheduler, Subject } from 'rxjs';
import { bufferTime, filter, map, switchMap } from 'rxjs/operators';

import { coerce } from '../utils/array';
import { FlattenObject, FlattenProperty, PropertyValue } from '../utils/flatten-object';

export interface PropertyOptions {
    bufferTime: number;
    omitOlderUpdates: boolean;
}

export interface PropertyActionOptions {
    source: symbol;
    emitEvent: boolean;
}

export interface PropertyChangedEvent {
    updates: PropertyChangedUpdateEvent[];
    source: symbol;
}

export interface PropertyHistory {
    ts: number;
    source: symbol;
    step: number;
    update: number;
    properties: {path: string[]; value: any}[];
}

export interface PropertyChangedUpdateEvent {
    path: string[];
    property: string;
    oldValue: any;
    newValue: any;
}

export type PropertyComparer = (path: string[], oldValue: any, newValue: any) => boolean;

const defaultComparer = (path: string[], oldValue: any, newValue: any) => {
    return oldValue === newValue;
};

export abstract class PropertyChanged<U extends object> implements IterableIterator<FlattenProperty> {
    protected readonly source = Symbol();
    private readonly actionDefaults: PropertyActionOptions = {
        source: this.source,
        emitEvent: true,
    };
    private readonly optionsDefaults: PropertyOptions = {
        bufferTime: 20,
        omitOlderUpdates: true,
    };
    protected comparer: PropertyComparer = defaultComparer;
    private _propertyChangedSource = new Subject<PropertyChangedEvent>();
    private _propertyChanged$: Observable<PropertyChangedEvent>;
    private _updating = 0;
    private _pendingPropertiesUpdates: PropertyChangedUpdateEvent[] = [];

    private _iteratorCounter = 0;
    private _iteratorItems: FlattenProperty[];
    private _history: PropertyHistory[] = [];
    private _historyPointIndex = 0;
    private _updates = 0;

    protected constructor(protected data: U, opts: Partial<PropertyOptions> = {}) {
        this._history = [this.initHistory(data)];
        const options = {...this.optionsDefaults, ...opts};
        this._propertyChanged$ = this.initObservable(options);
    }

    get value(): U {
        return {...this.data};
    }

    get updating(): boolean {
        return this._updating > 0;
    }

    get history(): PropertyHistory[] {
        return [...this._history];
    }

    get historyPointIndex(): number {
        return this._historyPointIndex;
    }

    get historyLength(): number {
        return this._history.length;
    }

    get properties(): FlattenProperty[] {
        return this.flattenProperties(this.data);
    }

    get paths(): string[][] {
        return this.properties.map(p => p.path);
    }

    public next(): IteratorResult<FlattenProperty> {
        if (this._iteratorCounter === 0) {
            this._iteratorItems = this.properties;
        }
        const current = this._iteratorItems[this._iteratorCounter];
        if (this._iteratorCounter >= this._iteratorItems.length - 1) {
            this._iteratorCounter = 0;
            return {
                done: true,
                value: current,
            };
        }
        this._iteratorCounter++;
        return {
            done: false,
            value: current,
        };
    }

    [Symbol.iterator](): IterableIterator<FlattenProperty> {
        return this;
    }

    undo(opts: Partial<PropertyActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        if (this._historyPointIndex === 0) {
            return;
        }
        this._historyPointIndex--;
        this.beginUpdate();
        const changes = this.mergeHistoryToPointIndex(this._historyPointIndex);
        changes.forEach(c => this.updateAndQueueEvent(options.source, c.value, c.path, options.emitEvent));
        this.endUpdate(options);
    }

    undoAll(opts: Partial<PropertyActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        if (this._historyPointIndex === 0) {
            return;
        }
        this._historyPointIndex = 0;
        this.beginUpdate();
        const changes = this.mergeHistoryToPointIndex(this._historyPointIndex);
        changes.forEach(c => this.updateAndQueueEvent(options.source, c.value, c.path, options.emitEvent));
        this.endUpdate(options);
    }

    redo(opts: Partial<PropertyActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        if (this.history.length === this._historyPointIndex + 1) {
            return;
        }
        this._historyPointIndex++;
        this.beginUpdate();
        const changes = this.mergeHistoryToPointIndex(this._historyPointIndex);
        changes.forEach(c => this.updateAndQueueEvent(options.source, c.value, c.path, options.emitEvent));
        this.endUpdate(options);
    }

    redoAll(opts: Partial<PropertyActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        if (this.history.length === this._historyPointIndex + 1) {
            return;
        }
        this._historyPointIndex = this.history.length - 1;
        this.beginUpdate();
        const changes = this.mergeHistoryToPointIndex(this._historyPointIndex);
        changes.forEach(c => this.updateAndQueueEvent(options.source, c.value, c.path, options.emitEvent));
        this.endUpdate(options);
    }

    public getPropertyValue(path: string | string[]): any {
        return this.getValue(this.data, coerce(path));
    }

    public setPropertyValue(path: string | string[], value: any, opts: Partial<PropertyActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        const coercedPath: string[] = coerce(path);
        if (!this.isUpdateValid(this.data, coercedPath, value)) {
            return;
        }
        this.updateAndQueueEvent(options.source, value, coercedPath, options.emitEvent);
        this.addPointToHistory(options.source, [{path: coercedPath, value}]);
    }

    public setPropertiesValue(data: Partial<U>, opts: Partial<PropertyActionOptions> = {}) {
        if (!data) {
            return;
        }
        const options = {...this.actionDefaults, ...opts};
        this.beginUpdate();
        const flattenObj = new FlattenObject(data as object);
        const properties: FlattenProperty[] = flattenObj.getProperties();
        const changes = [];
        for (const property of properties) {
            if (!this.isUpdateValid(this.data, property.path, property.value)) {
                continue;
            }
            this.updateAndQueueEvent(options.source, property.value, property.path, options.emitEvent);
            changes.push({value: property.value, path: property.path});
        }
        this.addPointToHistory(options.source, changes);
        this.endUpdate(options);
    }

    public listen(observer: symbol, ownUpdates = false): Observable<PropertyChangedEvent> {
        return this._propertyChanged$.pipe(filter(event => event.source !== observer || ownUpdates)) as Observable<PropertyChangedEvent>;
    }

    public beginUpdate() {
        this._updating++;
    }

    public endUpdate(opts: Partial<PropertyActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        if (this._updating === 0) {
            return;
        }
        this._updating--;
        if (this._updating === 0) {
            this.flushEventQueue(options.source, options.emitEvent);
        }
    }

    private flushEventQueue(source: symbol, emitEvent: boolean) {
        if (this._pendingPropertiesUpdates.length === 0) {
            return;
        }
        if (emitEvent) {
            this._propertyChangedSource.next({source, updates: this._pendingPropertiesUpdates});
        }
        this._pendingPropertiesUpdates = [];
    }

    private queueEvent(source: symbol, updates: PropertyChangedUpdateEvent[]) {
        if (this._updating > 0) {
            this._pendingPropertiesUpdates.push(...updates);
            return;
        }
        this._propertyChangedSource.next({source, updates});
    }

    protected notifyListeners(path: string[], value: any): boolean {
        return true;
    }

    protected getValue(data: U, path: string[]): any {
        let child: any = data;
        for (const property of path) {
            child = child[property];
        }
        return coerceToValue(child);
    }

    protected isUpdateValid(data: U, path: string[], value: any): boolean {
        let child: any = data;
        for (let i = 0; i < path.length; i++) {
            const property = path[i];
            if (!child.hasOwnProperty(property)) {
                return false;
            }
            if (i === path.length - 1 && this.comparer(path, coerceToValue(child[property]), value)) {
                return false;
            }
            child = child[property];
        }
        return true;
    }

    protected updateWithValue(data: U, path: string[], value: any): U {
        const newData: any = {...(data as any)};
        let child: any = newData;
        for (let i = 0; i < path.length; i++) {
            const property = path[i];
            if (i === path.length - 1) {
                child[property] = wrapValue(value);
                return newData;
            }
            child = child[property];
        }
        return newData;
    }

    protected flattenProperties(data: U): FlattenProperty[] {
        const flattenObj = new FlattenObject(data);
        return flattenObj.getProperties();
    }

    private initObservable(options: PropertyOptions) {
        return this._propertyChangedSource.asObservable().pipe(
            bufferTime(options.bufferTime, queueScheduler),
            filter(events => events.length > 0),
            map(events => (options.omitOlderUpdates ? trimEvents(events, this.comparer) : events)),
            switchMap(events => from(events))
        );
    }

    private initHistory(data: U): PropertyHistory {
        const props = this.flattenProperties(data);
        const point: PropertyHistory = {
            ts: Date.now(),
            source: this.source,
            step: 0,
            update: 0,
            properties: props.map(p => ({value: p.value, path: p.path})),
        };
        return point;
    }

    private updateAndQueueEvent(source: symbol, value: any, path: string[], emitEvent: boolean) {
        this._updates++;
        const oldValue = this.getValue(this.data, path);
        this.data = this.updateWithValue(this.data, path, value);
        if (emitEvent === false || !this.notifyListeners(path, value)) {
            return;
        }
        this.queueEvent(source, [
            {
                path,
                property: path[path.length - 1],
                newValue: value,
                oldValue,
            },
        ]);
    }

    private addPointToHistory(source: symbol, properties: {value: any; path: string[]}[]) {
        this._history.splice(this._historyPointIndex + 1, this._history.length - (this._historyPointIndex + 1));
        this._history.push({
            ts: Date.now(),
            source,
            step: this._history.length,
            update: this._updates,
            properties,
        });
        this._historyPointIndex++;
    }

    private mergeHistoryToPointIndex(index: number): {value: any; path: string[]}[] {
        const updates: {value: any; path: string[]}[] = [];
        // get the history up to index
        const historyToIndex = this._history.slice(0, index + 1);
        // reverse the history to find the most recent change first
        historyToIndex.reverse();
        const changes = flatten(historyToIndex.map(h => h.properties));
        for (const path of this.paths) {
            // look for any change for this path
            const change = changes.find(h => h.path.join('/') === path.join('/'));
            const newValue = change.value;
            const value = this.getPropertyValue(path);
            // check if most recent change, actually modifies the current value
            if (this.comparer(path, value, newValue)) {
                continue;
            }
            updates.push({value: newValue, path});
        }
        return updates;
    }
}

function flatten(array: any[][]): any[] {
    return array.reduce((result, item) => result.concat(item), []);
}

function wrapValue(obj: any) {
    if (obj instanceof Object && !(obj instanceof Array)) {
        return new PropertyValue(obj);
    }
    return obj;
}

function coerceToValue(obj: any) {
    if (obj instanceof PropertyValue) {
        return obj.value;
    }
    return obj;
}

function trimEvents(events: PropertyChangedEvent[], comparer: PropertyComparer): PropertyChangedEvent[] {
    // Reverse event so they are processed from more to less recent
    events.reverse();
    // collection of the latest unique change events
    const mostRecentEvents: PropertyChangedEvent[] = [];
    // collection of the latest unique update events
    const mostRecentUpdates: PropertyChangedUpdateEvent[] = [];
    for (const event of events) {
        // An event always contains a collection of unique update. There's no way of change a given property twice on a single update action
        // Filtered updates that belongs to the current event.
        // It will contain events, only if this events contains the most recent updates from all events.
        const mostRecentUpdatesPartOfCurrentEvent: PropertyChangedUpdateEvent[] = [];
        for (const update of event.updates) {
            const id = update.path.join('/');
            const mostRecentUpdate = mostRecentUpdates.find(m => m.path.join('/') === id);
            // Assing old value from older property updates. Events are being iterated in reverse order.
            if (mostRecentUpdate) {
                mostRecentUpdate.oldValue = update.oldValue;
                continue;
            }
            mostRecentUpdatesPartOfCurrentEvent.push(update);
            mostRecentUpdates.push(update);
        }
        // Exclude sources without property updates
        if (mostRecentUpdatesPartOfCurrentEvent.length === 0) {
            continue;
        }
        // Reassign just most recent updates
        mostRecentEvents.push({
            source: event.source,
            updates: mostRecentUpdatesPartOfCurrentEvent,
        });
    }
    // Reverse back leaving the sequence as it was
    return mostRecentEvents
        .map(e => ({
            ...e,
            updates: e.updates.filter(u => !comparer(u.path, u.oldValue, u.newValue)),
        }))
        .filter(e => e.updates.length > 0)
        .reverse();
}
