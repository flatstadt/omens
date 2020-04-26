import { RecipientAnswer } from './messenger';

export class Receipt {
    constructor(private readonly cf: () => void, readonly answer: RecipientAnswer) {}

    requestCancellation() {
        this.cf();
    }
}
