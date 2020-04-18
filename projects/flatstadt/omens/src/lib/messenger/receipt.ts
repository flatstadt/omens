import { RecipientAnswer } from './messenger';

export class Receipt {
    private _delivered = false;

    constructor(private readonly cf: () => void, readonly cb: RecipientAnswer) {}

    requestCancellation() {
        this.cf();
    }
}
