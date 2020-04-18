import { asyncScheduler, Observable, of, ReplaySubject, Subject } from 'rxjs';
import { delay, filter, map, take } from 'rxjs/operators';

import { Delivery } from './delivery';
import { Envelope } from './envelope';
import { Message } from './message';
import { Receipt } from './receipt';

// dynamic
export class Messenger {
    private queue: Subject<Delivery<Message>> = null;
    private disposed = false;

    constructor(bufferSize = 0, ttl = 1000, readonly scheduler = asyncScheduler) {
        if (bufferSize === 0) {
            this.queue = new Subject<Delivery<Message>>();
        } else {
            this.queue = new ReplaySubject<Delivery<Message>>(bufferSize, ttl);
        }
    }

    public static default(): Messenger {
        return defaultMessenger;
    }

    public sendToOne<T extends Message>(msg: T, cb?: RecipientAnswer): Receipt {
        if (this.disposed) {
            throw new Error('messenger disposed');
        }
        const delivery = new Delivery(msg, cb, true);
        const cancel = () => {
            delivery.cancel();
        };
        of(delivery)
            .pipe(delay(msg.delay, this.scheduler), take(1))
            .subscribe(e => this.queue.next(e));
        return new Receipt(cancel, cb);
    }

    public broadcast<T extends Message>(msg: T, cb?: RecipientAnswer): Receipt {
        if (this.disposed) {
            throw new Error('messenger disposed');
        }
        const delivery = new Delivery(msg, cb);
        const cancel = () => {
            delivery.cancel();
        };
        of(delivery)
            .pipe(delay(msg.delay, this.scheduler), take(1))
            .subscribe(e => this.queue.next(e));
        return new Receipt(cancel, cb);
    }

    public listen<T extends Message>(type: MessageConstructor<T>): Observable<Envelope<T>> {
        return this.queue.asObservable().pipe(
            filter(d => !d.expired),
            filter(d => !d.cancelled),
            filter(d => !d.delivered),
            filter(d => d.contains(type)),
            map(d => d.deliverEnvelope())
        ) as Observable<Envelope<T>>;
    }

    public listenToAll(): Observable<Envelope<Message>> {
        return this.queue.asObservable().pipe(
            filter(d => !d.expired),
            filter(d => !d.cancelled),
            filter(d => !d.delivered),
            map(d => d.deliverEnvelope())
        );
    }

    dispose(): void {
        this.queue.complete();
        this.disposed = true;
    }
}

const defaultMessenger: Messenger = new Messenger();

export type MessageConstructor<T> = new (...args) => T;
export type RecipientAnswer = (ans: any) => void;
