import { Message } from './message';
import { RecipientAnswer } from './messenger';

export class Envelope<T extends Message> {
    private _deliveredAt = Date.now();
    private _opened = false;
    constructor(private readonly message: T, private cb?: RecipientAnswer) {}

    get deliveredAt(): number {
        return this._deliveredAt;
    }

    get opened(): boolean {
        return this._opened;
    }

    get expired(): boolean {
        return this.message.expired;
    }

    read(answer?: any): T {
        if (this._opened || this.message.expired) {
            throw new Error('message already opened and/or expired');
        }
        // tslint:disable-next-line: no-unused-expression
        this.cb && this.cb(answer);
        this._opened = true;
        return this.message;
    }
}
