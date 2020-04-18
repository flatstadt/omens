import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

const defaultComparer = (prop: string, oldValue: any, newValue: any) => oldValue === newValue;

export interface ModelChangedEventOpts {
    emitEvent: boolean;
}

export abstract class ModelChanged<U extends any> {
    private _modelChangedSource = new Subject<symbol>();
    private _updating = 0;
    private _history: {ts: number; step: number; update: number; value: Partial<U>}[] = [];
    private _historyPointIndex = 0;
    private _data = null;
    private _updates = 0;
    protected readonly source: symbol = Symbol();
    protected comparer: (prop: string, oldValue: any, newValue: any) => boolean = defaultComparer;

    protected constructor(data: U) {
        this._data = data;
        this._history.push({ts: Date.now(), step: 0, update: 0, value: {...data}});
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

    get history(): {ts: number; step: number; value: Partial<U>}[] {
        return this._history.map(i => ({...i}));
    }

    get historyPointIndex(): number {
        return this._historyPointIndex;
    }

    get numberOfChanges(): number {
        return this._history.length;
    }

    undo(opt: Partial<ModelChangedEventOpts> = {}) {
        if (this._historyPointIndex === 0) {
            return;
        }
        this._historyPointIndex--;
        const data = this.mergeHistoryToInstantIndex(this._historyPointIndex);
        this.updateModel(this.source, data, (opt || {}).emitEvent);
    }

    undoAll(opt: Partial<ModelChangedEventOpts> = {}) {
        if (this._historyPointIndex === 0) {
            return;
        }
        this._historyPointIndex = 0;
        const data = this.mergeHistoryToInstantIndex(this._historyPointIndex);
        this.updateModel(this.source, data, (opt || {}).emitEvent);
    }

    redo(opt: Partial<ModelChangedEventOpts> = {}) {
        if (this.history.length === this._historyPointIndex + 1) {
            return;
        }
        this._historyPointIndex++;
        const data = this.mergeHistoryToInstantIndex(this._historyPointIndex);
        this.updateModel(this.source, data, (opt || {}).emitEvent);
    }

    redoAll(opt: Partial<ModelChangedEventOpts> = {}) {
        if (this.history.length === this._historyPointIndex + 1) {
            return;
        }
        this._historyPointIndex = this.history.length - 1;
        const data = this.mergeHistoryToInstantIndex(this._historyPointIndex);
        this.updateModel(this.source, data, (opt || {}).emitEvent);
    }

    getPropertyValue<K extends keyof U>(key: K) {
        return this._data[key];
    }

    update(source: symbol, value: Partial<U>, opt: Partial<ModelChangedEventOpts> = {}) {
        const changedChunk = this.extractChangedChunk(this._data, value);
        if (!changedChunk || Object.keys(changedChunk).length === 0) {
            return;
        }
        this._updates++;
        this.addPointToHistory(changedChunk);
        const data = {...(this._data as any), ...(changedChunk as any)};
        this.updateModel(source, data, (opt || {}).emitEvent);
    }

    listen(observer: symbol, ignoreOwnUpdates: boolean = true): Observable<U> {
        return this._modelChangedSource.pipe(
            filter(source => source !== observer || !ignoreOwnUpdates),
            map(() => this.value)
        ) as Observable<U>;
    }

    beginUpdate() {
        this._updating++;
    }

    endUpdate(source: symbol) {
        if (this._updating === 0) {
            return;
        }
        this._updating--;
        if (this._updating === 0) {
            this._modelChangedSource.next(source);
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

    private addPointToHistory(data: Partial<U>) {
        this._history.splice(this._historyPointIndex + 1, this._history.length - (this._historyPointIndex + 1));
        this._history.push({ts: Date.now(), step: this._history.length, update: this._updates, value: data});
        this._historyPointIndex++;
        console.log('history', this._history, this._historyPointIndex);
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
