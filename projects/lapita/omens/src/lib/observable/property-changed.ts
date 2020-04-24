import { from, Observable, Subject } from 'rxjs';
import { bufferTime, filter, map, switchMap } from 'rxjs/operators';

import { coerce } from '../utils/array';
import { FlattenObject, FlattenProperty, PropertyValue } from '../utils/flatten-object';

export interface PropertyOptions {
    bufferTime: number;
    dequeueOldUpdates: boolean;
}

export interface PropertyActionOptions {
    source: symbol;
    emitEvent: boolean;
}

export interface PropertyChangedEvent {
    updates: PropertyChangedUpdateEvent[];
    source: symbol;
}

export interface PropertyChangedUpdateEvent {
    path: string[];
    property: string;
    oldValue: any;
    newValue: any;
}

export abstract class PropertyChanged<U extends object> implements IterableIterator<FlattenProperty> {
    private _propertyChangedSource = new Subject<PropertyChangedEvent>();
    private _propertyChanged$: Observable<PropertyChangedEvent>;
    private _updating = 0;
    private _pendingPropertiesUpdates: PropertyChangedUpdateEvent[] = [];
    private _optionsDefaults: PropertyOptions = {
        bufferTime: 100,
        dequeueOldUpdates: false,
    };
    private source = Symbol();
    private actionDefaults: PropertyActionOptions = {
        source: this.source,
        emitEvent: true,
    };
    private counter = 0;
    private items: FlattenProperty[];

    protected constructor(protected data: U, opts: Partial<PropertyOptions> = {}) {
        const options = {...opts, ...this._optionsDefaults};
        this._propertyChanged$ = this._propertyChangedSource.asObservable().pipe(
            bufferTime(options.bufferTime),
            map((events: PropertyChangedEvent[]) => trimEvents(events, options.dequeueOldUpdates)),
            filter(items => items.length !== 0),
            switchMap(events => from(events))
        );
    }

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
                value: current,
            };
        }
        this.counter++;
        return {
            done: false,
            value: current,
        };
    }

    [Symbol.iterator](): IterableIterator<FlattenProperty> {
        return this;
    }

    public getPropertyValue(path: string | string[]): any {
        return this.getValue(this.data, coerce(path));
    }

    public setPropertyValue(path: string | string[], value: any, opts: Partial<PropertyActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        const coercedPath: string[] = coerce(path);
        if (!this.checkIfValidUpdate(this.data, coercedPath, value)) {
            return;
        }
        const oldValue = this.getValue(this.data, coercedPath);
        this.data = this.updateWithValue(this.data, coercedPath, value);
        this.notifyObservers(options.source, {
            path: coercedPath,
            property: coercedPath[coercedPath.length - 1],
            newValue: value,
            oldValue,
        });
    }

    public setPropertiesValue(data: Partial<U>, opts: Partial<PropertyActionOptions> = {}) {
        if (!data) {
            return;
        }
        this.beginUpdate();
        const flattenObj = new FlattenObject(data as object);
        const properties: FlattenProperty[] = flattenObj.getProperties();
        properties.forEach(p => {
            this.setPropertyValue(p.path, p.value, opts);
        });
        this.endUpdate(opts);
    }

    public listen(observer: symbol, ownUpdates = false): Observable<PropertyChangedEvent> {
        return this._propertyChanged$.pipe(filter(event => !(event.source === observer) || ownUpdates)) as Observable<PropertyChangedEvent>;
    }

    beginUpdate() {
        this._updating++;
    }

    endUpdate(opts: Partial<PropertyActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        if (this._updating === 0) {
            return;
        }
        this._updating--;
        if (this._updating === 0 && options.emitEvent) {
            this._propertyChangedSource.next({source: options.source, updates: [...this._pendingPropertiesUpdates]});
            this._pendingPropertiesUpdates = [];
        }
    }

    protected notifyObservers(source: symbol, update: PropertyChangedUpdateEvent) {
        if (this._updating > 0) {
            this._pendingPropertiesUpdates.push(update);
            return;
        }
        this._propertyChangedSource.next({source, updates: [update]});
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
              console.log('property not found', child, property)
                return false;
            }
            if (i === path.length - 1 && coerceToValue(child[property]) === value) {
              console.log('last property', value, child )
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

function trimEvents(events: PropertyChangedEvent[], preserveOldUpdates: boolean): PropertyChangedEvent[] {
  if (preserveOldUpdates === true || events.length === 0) {
      return events;
  }
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
