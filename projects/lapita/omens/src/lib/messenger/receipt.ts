import { RecipientAnswer } from './messenger';

export class Receipt {
    constructor(private readonly cf: () => void, readonly cb: RecipientAnswer) {}

    requestCancellation() {
        this.cf();
    }
}
