import {asyncScheduler, Observable, of, ReplaySubject, SchedulerLike, Subject} from 'rxjs';
import { delay, filter, map, take } from 'rxjs/operators';

import { Delivery } from './delivery';
import { Envelope } from './envelope';
import { Message } from './message';
import { Receipt } from './receipt';

export interface MessengerOptions {
  buffer: number;
  delay: number;
  ttl: number;
  scheduler: SchedulerLike;
}

// dynamic
export class Messenger {
    private queue: Subject<Delivery<Message>> = null;
    private disposed = false;
    private readonly options: MessengerOptions;
    private readonly defaults: MessengerOptions = {
      buffer: 0,
      delay: 0,
      ttl: 1000,
      scheduler: asyncScheduler
    };

    constructor(options: Partial<MessengerOptions> = {}) {
        this.options = {...this.defaults, ...options};
        if (this.options.buffer === 0) {
            this.queue = new Subject<Delivery<Message>>();
        } else {
            this.queue = new ReplaySubject<Delivery<Message>>(this.options.buffer , this.options.ttl);
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
        return this.deliverMessage(delivery);
    }

    public broadcast<T extends Message>(msg: T, cb?: RecipientAnswer): Receipt {
        if (this.disposed) {
            throw new Error('messenger disposed');
        }
        const delivery = new Delivery(msg, cb);
        return this.deliverMessage(delivery);
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

    public dispose(): void {
        this.queue.complete();
        this.disposed = true;
    }

    private deliverMessage<T extends Message>(delivery: Delivery<T>): Receipt {
      const cancel = () => {
        delivery.cancel();
      };
      of(delivery)
        .pipe(delay(delivery.message.delay || this.options.delay, this.options.scheduler), take(1))
        .subscribe(e => this.queue.next(e));
      return new Receipt(cancel, delivery.callback);
    }
}

const defaultMessenger: Messenger = new Messenger();

export type MessageConstructor<T> = new (...args) => T;
export type RecipientAnswer = (ans: any) => void;
