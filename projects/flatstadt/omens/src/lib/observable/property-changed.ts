import {from, Observable, Subject} from 'rxjs';
import {bufferTime, filter, map, switchMap} from 'rxjs/operators';
import {FlattenObject, FlattenProperty, PropertyValue} from '../utils/flatten-object';
import {coerce} from '../utils/array';

export interface PropertyChangedOpts {
    bufferTime: number;
    dequeueOldUpdates: boolean;
}

function trimEvents(events: PropertyChangedEvent[],  preserveOldUpdates: boolean): PropertyChangedEvent[] {
    if (preserveOldUpdates === true || events.length === 0) { return events; }
    // Reverse event so they are processed from more to less recent
    const reversedEvents = events.reverse();
    const mostRecentEvents: PropertyChangedEvent[] = [];
    const mostRecentUpdates: PropertyChangedUpdateEvent[] = [];
    for (const e of reversedEvents) {
        // Filtered updates to be assigned to the current event
        const filteredEventUpdates = [];
        for (const u of e.updates) {
            const id = u.path.join('/');
            const recentUpdate = mostRecentUpdates.find(m => m.path.join('/') === id);
            // Take old value from lass recent property updates
            if (recentUpdate) {
                recentUpdate.oldValue = u.oldValue;
                continue;
            }
            filteredEventUpdates.push(u);
            mostRecentUpdates.push(u);
        }
        // Exclude sources without property updates
        if (filteredEventUpdates.length === 0) {
            continue;
        }
        // Reassign just most recent updates
        e.updates = filteredEventUpdates;
        mostRecentEvents.push(e);
    }
    // Reverse back to leave the sequence as it was
    return mostRecentEvents.reverse();
}

export abstract class PropertyChanged<U extends object> implements IterableIterator<FlattenProperty> {
    private propertyChangedSource = new Subject<PropertyChangedEvent>();
    private propertyChanged$ = this.propertyChangedSource.asObservable().pipe(
        bufferTime(this.opts.bufferTime ? this.opts.bufferTime : 100),
        map((events: PropertyChangedEvent[]) => trimEvents(events, this.opts.dequeueOldUpdates)),
        filter(items => items.length !== 0),
        switchMap(events => from(events))
    );
    private _updating = 0;
    private _pendingPropertiesUpdatesToNotify: PropertyChangedUpdateEvent[] = [];

    private counter = 0;
    private items: FlattenProperty[];

    protected constructor(protected data: U, private opts: PropertyChangedOpts = {bufferTime: 100, dequeueOldUpdates: false}) {}

    get updating(): boolean {
        return this._updating > 0;
    }

    public next(): IteratorResult<FlattenProperty> {
        if (this.counter === 0) {
            this.items = this.flattenProperties(this.data);
        }
        const current = this.items[this.counter];
        if (this.counter >= this.items.length - 1) {
            this.counter = 0;
            return {
                done: true,
                value: current
            };
        }
        this.counter++;
        return {
            done: false,
            value: current
        };
    }

    [Symbol.iterator](): IterableIterator<FlattenProperty> {
        return this;
    }

    public getPropertyValue(path: string | string[]): any {
        return this.getValue(this.data, coerce(path));
    }

    public setPropertyValue(source: Symbol, path: string | string[], value: any) {
        const coercedPath: string[] = coerce(path);
        if (!this.checkIfValidUpdate(this.data, coercedPath, value)) {
            return;
        }
        const oldValue = this.getValue(this.data, coercedPath);
        this.data = this.updateWithValue(this.data, coercedPath, value);
        this.notifyObservers(source, {
            path: coercedPath,
            property: coercedPath[coercedPath.length - 1],
            newValue: value,
            oldValue
        });
    }

    public setPropertiesValue(source: Symbol, data: Partial<U>) {
        if (!data) {
            return;
        }
        this.beginUpdate();
        const flattenObj = new FlattenObject(data as object);
        const properties: FlattenProperty[] = flattenObj.getProperties();
        properties.forEach(p => {
            this.setPropertyValue(source, p.path, p.value);
        });
        this.endUpdate(source);
    }

    public register(observer: Symbol, ignoreOwnUpdates: boolean = true): Observable<PropertyChangedEvent> {
        return this.propertyChanged$.pipe(filter(event => !(event.source === observer) || !ignoreOwnUpdates)) as Observable<PropertyChangedEvent>;
    }

    beginUpdate() {
        this._updating++;
    }

    endUpdate(source: Symbol) {
        if (this._updating === 0) {
            return;
        }
        this._updating--;
        if (this._updating === 0) {
            this.propertyChangedSource.next({source, updates: [...this._pendingPropertiesUpdatesToNotify]});
            this._pendingPropertiesUpdatesToNotify = [];
        }
    }

    protected notifyObservers(source: Symbol, update: PropertyChangedUpdateEvent) {
        if (this._updating > 0) {
            this._pendingPropertiesUpdatesToNotify.push(update);
            return;
        }
        this.propertyChangedSource.next({source, updates: [update]});
    }

    protected getValue(data: U, path: string[]): any {
        let child: any = data;
        for (const property of path) {
            child = child[property];
        }
        return coerceToValue(child);
    }

    protected checkIfValidUpdate(data: U, path: string[], value: any): boolean {
        let child: any = data;
        for (let i = 0; i < path.length; i++) {
            const property = path[i];
            if (!child.hasOwnProperty(property)) {
                return false;
            }
            if (i === path.length - 1 && coerceToValue(child[property]) === value) {
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

export interface PropertyChangedEvent {
    updates: PropertyChangedUpdateEvent[];
    source: Symbol;
}

export interface PropertyChangedUpdateEvent {
    path: string[];
    property: string;
    oldValue: any;
    newValue: any;
}
