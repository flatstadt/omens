import {Message, Messenger} from '@lapita/omens';
import {asapScheduler} from 'rxjs';

export class MessengerPlayground {

  public static play() {
    // Listening to CustomMessage sent through the default messenger
    Messenger.default().listen(CustomMessage).subscribe(env => console.log('listener 1: msg received', env.read()));
    Messenger.default().listen(CustomMessage).subscribe(env => console.log('listener 2: msg received', env.read()));
    console.log('Send message to only one listener');
    Messenger.default().sendToOne(new CustomMessage('unique message'));
    console.log('Broadcast message');
    Messenger.default().broadcast(new CustomMessage('broadcast message'));
    // Cancel a message delivery
    const receipt = Messenger.default().broadcast(new CustomMessage('Oops! wrong broadcast message'));
    receipt.requestCancellation();
    // Send a temporary message that will expired due to its delay
    const messenger = new Messenger(10, 1000, asapScheduler);
    messenger.broadcast(new CustomMessage('broadcast permanent message through a custom messenger'));
    messenger.broadcast(new TemporaryCustomMessage('broadcast temporary message through a custom messenger'));
    setTimeout(() => {
      messenger.listenToAll().subscribe(env => console.log('listener 3: msg received', env.read()));
    }, 500);
  }
}

class TemporaryCustomMessage extends Message {
  constructor(public text: string) {
    super(0, 200);
  }
}


class CustomMessage extends Message {
  constructor(public text: string) {
    super(10);
  }
}
