import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

const defaultComparer = (prop: string, oldValue: any, newValue: any) => oldValue === newValue;

export interface ModelHistory<U> {
    ts: number;
    source: symbol;
    step: number;
    update: number;
    value: Partial<U>;
}

export interface ModelActionOptions {
    source: symbol;
    emitEvent: boolean;
}

export abstract class ModelChanged<U extends any> {
    protected readonly source: symbol = Symbol('model');
    protected comparer: (prop: string, oldValue: any, newValue: any) => boolean = defaultComparer;
    private actionDefaults: ModelActionOptions = {
        source: this.source,
        emitEvent: true,
    };
    private _modelChangedSource = new Subject<symbol>();
    private _updating = 0;
    private _history: {ts: number; source: symbol; step: number; update: number; value: Partial<U>}[] = [];
    private _historyPointIndex = 0;
    private _data = null;
    private _updates = 0;

    protected constructor(data: U) {
        this._data = data;
        this._history.push({
            ts: Date.now(),
            source: this.source,
            step: 0,
            update: 0,
            value: {...data},
        });
    }

    get modelChanged(): Observable<U> {
        return this._modelChangedSource.asObservable().pipe(map(() => this.value));
    }

    get updating(): boolean {
        return this._updating > 0;
    }

    get value(): U {
        return {...this._data};
    }

    get history(): ModelHistory<U>[] {
        return [...this._history];
    }

    get historyPointIndex(): number {
        return this._historyPointIndex;
    }

    get numberOfChanges(): number {
        return this._history.length - 1;
    }

    undo(opts: Partial<ModelActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        if (this._historyPointIndex === 0) {
            return;
        }
        this._historyPointIndex--;
        const data = this.mergeHistoryToInstantIndex(this._historyPointIndex);
        this.updateModel(options.source, data, options.emitEvent);
    }

    undoAll(opts: Partial<ModelActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        if (this._historyPointIndex === 0) {
            return;
        }
        this._historyPointIndex = 0;
        const data = this.mergeHistoryToInstantIndex(this._historyPointIndex);
        this.updateModel(options.source, data, options.emitEvent);
    }

    redo(opts: Partial<ModelActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        if (this.history.length === this._historyPointIndex + 1) {
            return;
        }
        this._historyPointIndex++;
        const data = this.mergeHistoryToInstantIndex(this._historyPointIndex);
        this.updateModel(options.source, data, options.emitEvent);
    }

    redoAll(opts: Partial<ModelActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        if (this.history.length === this._historyPointIndex + 1) {
            return;
        }
        this._historyPointIndex = this.history.length - 1;
        const data = this.mergeHistoryToInstantIndex(this._historyPointIndex);
        this.updateModel(options.source, data, options.emitEvent);
    }

    getPropertyValue<K extends keyof U>(key: K): any {
        return this._data[key];
    }

    getPartialValue<K extends keyof U>(keys: K[]): Partial<U> {
        return keys.reduce((obj, k) => {
          obj[k as string] = this._data[k as string];
          return obj;
        }, {});
    }

    update(value: Partial<U>, opts: Partial<ModelActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        const changedChunk = this.extractChangedChunk(this._data, value);
        if (!changedChunk || Object.keys(changedChunk).length === 0) {
            return;
        }
        this._updates++;
        this.addPointToHistory(options.source, changedChunk);
        const data = {...(this._data as any), ...(changedChunk as any)};
        this.updateModel(options.source, data, options.emitEvent);
    }

    listen(observer: symbol, ownUpdates = false): Observable<U> {
        return this._modelChangedSource.pipe(
            filter(source => source !== observer || ownUpdates),
            map(() => this.value)
        ) as Observable<U>;
    }

    beginUpdate() {
        this._updating++;
    }

    endUpdate(opts: Partial<ModelActionOptions> = {}) {
        const options = {...this.actionDefaults, ...opts};
        if (this._updating === 0) {
            return;
        }
        this._updating--;
        if (this._updating === 0 && options.emitEvent) {
            this._modelChangedSource.next(options.source);
        }
    }

    protected notifyListeners(props: string[]): boolean {
        return true;
    }

    protected extractChangedChunk(current: U, newValue: Partial<U>): Partial<U> {
        const changedChunk = {};
        const properties: string[] = Object.keys(newValue);
        for (const prop of properties) {
            if (this.comparer(prop, current[prop], newValue[prop])) {
                continue;
            }
            changedChunk[prop] = newValue[prop];
        }
        return changedChunk;
    }

    private addPointToHistory(source: symbol, data: Partial<U>) {
        this._history.splice(this._historyPointIndex + 1, this._history.length - (this._historyPointIndex + 1));
        this._history.push({
            ts: Date.now(),
            source,
            step: this._history.length,
            update: this._updates,
            value: data,
        });
        this._historyPointIndex++;
    }

    private updateModel(source: symbol, data: U, emitEvent: boolean) {
        this._data = data;
        if (emitEvent === false || this._updating > 0 || !this.notifyListeners(Object.keys(data))) {
            return;
        }
        this._modelChangedSource.next(source);
    }

    private mergeHistoryToInstantIndex(index: number): U {
        let data = {};
        for (let i = 0; i <= index; i++) {
            data = {...data, ...this._history[i].value};
        }
        return data as U;
    }
}
