import { Envelope } from './envelope';
import { Message } from './message';
import { MessageConstructor, RecipientAnswer } from './messenger';

export class Delivery<T extends Message> {
    private _cancelled = false;
    private _numberOfDeliveries = 0;
    constructor(private readonly msg: T, private cb?: RecipientAnswer, readonly unique = false) {}

    get message(): T {
      return this.msg;
    }

    get callback(): RecipientAnswer {
      return this.cb;
    }

    get delivered(): boolean {
        return this.unique && this._numberOfDeliveries > 0;
    }

    get cancelled(): boolean {
        return this._cancelled;
    }

    get expired(): boolean {
        return this.msg.expired;
    }

    deliverEnvelope(): Envelope<T> {
        this._numberOfDeliveries++;
        return new Envelope(this.msg, this.cb);
    }

    contains(type: MessageConstructor<T>): boolean {
        return this.msg instanceof type;
    }

    cancel() {
        this._cancelled = true;
    }
}
