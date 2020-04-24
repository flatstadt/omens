import { async, fakeAsync, tick } from '@angular/core/testing';
import { Message, Messenger } from '@lapita/omens';
import { asapScheduler } from 'rxjs';

import createSpy = jasmine.createSpy;
class MessageMock extends Message {
  constructor(delay = 0, expiration = -1) {
    super(delay, expiration);
  }
}

class InstantMessageMock extends Message {
  constructor() {
    super();
  }
}

describe('Omens: Messenger', () => {
  let messenger;
  beforeEach(() => {
    messenger = new Messenger();
  });

  it('should have default messenger', () => {
    expect(Messenger.default).toBeTruthy();
  });

  it('should send message', async(() => {
    messenger.listen(MessageMock).subscribe(e => expect(e).toBeTruthy());
    messenger.sendToOne(new MessageMock());
  }));

  it('should receive answer message', fakeAsync(() => {
    messenger.listen(MessageMock).subscribe(d => d.read());
    const spyFnc = createSpy('callback', () => {});
    messenger.sendToOne(new MessageMock(), spyFnc);
    tick(100);
    expect(spyFnc).toHaveBeenCalled();
  }));

  it('should send delayed message', fakeAsync(() => {
    messenger.listen(MessageMock).subscribe(d => expect(Date.now() - d.read().createdAt >= 100).toBeTruthy());
    messenger.sendToOne(new MessageMock(100));
    tick(125);
  }));

  it('should broadcast', fakeAsync(() => {
    const spyFnc = createSpy('callback', e => {});
    messenger.listen(MessageMock).subscribe(spyFnc);
    messenger.listen(MessageMock).subscribe(spyFnc);
    messenger.broadcast(new MessageMock());
    tick();
    expect(spyFnc).toHaveBeenCalledTimes(2);
  }));

  it('should send one copy', fakeAsync(() => {
    const spyFnc = createSpy('callback', e => {});
    messenger.listen(MessageMock).subscribe(spyFnc);
    messenger.listen(MessageMock).subscribe(spyFnc);
    messenger.sendToOne(new MessageMock());
    tick();
    expect(spyFnc).toHaveBeenCalledTimes(1);
  }));

  it('should listen to all', fakeAsync(() => {
    const spyFnc = createSpy('callback', e => {});
    messenger.listenToAll().subscribe(spyFnc);
    messenger.sendToOne(new MessageMock());
    messenger.sendToOne(new InstantMessageMock());
    tick();
    expect(spyFnc).toHaveBeenCalledTimes(2);
  }));

  it('should not received message', fakeAsync(() => {
    messenger.broadcast(new MessageMock());
    messenger.broadcast(new MessageMock());
    const spyFcn = createSpy('subscription', e => {});
    tick();
    messenger.listen(MessageMock).subscribe(spyFcn);
    tick();
    expect(spyFcn).not.toHaveBeenCalled();
  }));

  it('should received last messages', fakeAsync(() => {
    messenger = new Messenger({buffer: 2});
    messenger.broadcast(new MessageMock());
    messenger.broadcast(new MessageMock());
    const spyFcn = createSpy('subscription', e => {});
    tick();
    messenger.listen(MessageMock).subscribe(spyFcn);
    tick();
    expect(spyFcn).toHaveBeenCalledTimes(2);
  }));

  it('should not receive expired message', fakeAsync(() => {
    messenger = new Messenger({buffer: 20, scheduler: asapScheduler});
    messenger.broadcast(new MessageMock(0, 200));
    const spyFcn = createSpy('subscription', e => {});
    tick(300);
    messenger.listen(MessageMock).subscribe(spyFcn);
    tick();
    expect(spyFcn).not.toHaveBeenCalled();
  }));

  it('should receive message with expiration', fakeAsync(() => {
    messenger = new Messenger({buffer: 20, scheduler: asapScheduler});
    messenger.broadcast(new MessageMock(0, 200));
    const spyFcn = createSpy('subscription', e => {});
    tick(30);
    messenger.listen(MessageMock).subscribe(spyFcn);
    tick();
    expect(spyFcn).toHaveBeenCalled();
  }));

  it('should cancel delivery', fakeAsync(() => {
    const spyFcn = createSpy('subscription', e => {});
    messenger.listen(MessageMock).subscribe(spyFcn);
    const receipt = messenger.broadcast(new MessageMock(100));
    receipt.requestCancellation();
    tick(200);
    expect(spyFcn).not.toHaveBeenCalled();
  }));

  it('should not cancel delivery', fakeAsync(() => {
    const spyFcn = createSpy('subscription', e => {});
    messenger.listen(MessageMock).subscribe(spyFcn);
    const receipt = messenger.broadcast(new MessageMock(0));
    tick(25);
    receipt.requestCancellation();
    expect(spyFcn).toHaveBeenCalled();
  }));
});
