export abstract class Message {
  public readonly createdAt = Date.now();
  protected constructor(readonly delay = 0, readonly expiration = -1) {}

  get expired(): boolean {
    return this.expiresAt !== -1 && this.expiresAt < Date.now();
  }

  get expiresAt(): number {
    return this.expiration === -1 ? -1 : this.expiration + this.createdAt;
  }
}
