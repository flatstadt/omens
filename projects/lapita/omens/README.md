[![MIT](https://img.shields.io/packagist/l/doctrine/orm.svg?style=flat-square)]()
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![All Contributors](https://img.shields.io/badge/all_contributors-0-orange.svg?style=flat-square)](#contributors-)
[![flatstadt](https://img.shields.io/badge/@-flatstadt-383636?style=flat-square&labelColor=8f68d4)](https://github.com/flatstadt/)


> Omens helps managing internal events

Frequently, we are in need to propagate changes and notify multiple listeners in a way that it doesn't create event loops. Omens helps to keep control over your event flow.

## Features

- ✅ Messenger
- ✅ Observable Model
- ✅ Observable Properties

## Table of Contents

- [Features](#features)
- [Table of Contents](#table-of-contents)
- [Installation](#installation)
  - [NPM](#npm)
  - [Yarn](#yarn)
- [Usage](#usage)
  - [Messenger](#messenger)
  - [Observable Model](#observable-model)
  - [Observable Property Changed](#observable-property-changed)


## Installation

### NPM

`npm install @lapita/omens --save`

### Yarn

`yarn add @lapita/omens`

## Usage
Omens offers three different functionalities. A messenger to broadcast messages across components. An observable model that help to notify observers that their underlying model has changed and could react accordingly. Lastly, an observable property changed extension that creates events every time a property value changes.

### Messenger
The messenger allows to send a message to multiple listeners. There's a default messenger that can be accessed as `Messenger.default()`, but it also possible to create new instances by doing `new Messenger()`.

Each instance of `Messenger` keeps their messages separated. They work like separated delivery systems.

When instancing a new Messenger, it's possible to pass in options to tune they way it works.

```ts
export interface MessengerOptions {
  buffer: number; // size of the internal buffer.
  delay: number; // default delay of messages
  ttl: number; // default expiration of the buffer
  scheduler: SchedulerLike; // RXJS observable scheduler
}
```
The messenger uses an internal queue which is a hot observable. The events published before start listening are gone. The buffer size allows to always return the last n-number of messages.

Messages are custom classes that extends `Messages`. When sending a new message, a new instance of the Messages is created. A listener can subscribe to a Message type by passing in the class name.

```ts
import { Message, Messenger } from '@lapita/omens';

export class MessengerPlayground {

  public static play() {
    // Listening to CustomMessage sent through the default messenger
    Messenger.default().listen(CustomMessage).subscribe(env => console.log('listener: msg received', env.read()));
    console.log('Send message to only one listener');

    Messenger.default().broadcast(new CustomMessage('broadcast message'));
  }
}

class CustomMessage extends Message {
  constructor(public text: string) {
    super();
  }
}
```

* `default()` - return the default `Messenger` instance.

* `listen(type): Observable<Envelope>` - listen to a type of Message

```ts
Messenger.default().listen(CustomMessage).subscribe();
```
The subscription returns a `Envelope`. An envelope contains the sent Message.

```ts
interface Envelope<T extends Message> {
    get deliveredAt(): number; // when the envelope was received
    get opened(): boolean; // whether message was already read
    get expired(): boolean; // whether message expired
    read(answer?: any): T; // get the inside message. It's possible to send an answer to the sender.
}
```

* `listenToAll(): Observable<Envelope>` - listen to any type of Message

```ts
Messenger.default().listenToAll().subscribe();
```
* `sendToOne(msg: Message, cb?: RecipientAnswer): Receipt` - send a single message

This way of sending a message makes sure that only one listener receives the message even when there are multiple subscribers.

Optionally, it's possible to add a callback function `RecipientAnswer` to receive answers from recipients.
```ts
const answer = (answer) => {console.log('Answer received')}
const receipt = Messenger.default().sentToOne(new CustomMessage(), answer);
```
It returns a `Receipt`.

```ts
interface Receipt {
    answer: RecipientAnswer; // returns a reference of the optional answer callback fcn.
    requestCancellation(); // cancels the message delivery
}
```
* `broadcast(msg: Message, cb?: RecipientAnswer): Receipt` - broadcast a message to all listeners

### Observable Model
By using `ModelChanged`, any class becomes observable to any change. Observers can subscribe to changes and apply updates. Any change has attached a source which allows to break infinity update loops.

```ts
import { ModelChanged } from '@lapita/omens';

// Observable Model Container
export class AppService extends ModelChanged<AppModel> {
  constructor() {
    super(new AppModel());
  }
}

// Model
class AppModel {
  name = 'John';
  lastname = 'Connor';
  createdAt = 1000;
}
```
`ModelChanged<AppModel>` passes the needed functionality to the model container that allows to interact with it and observe changes.

```ts
export abstract class ModelChanged<U extends any> {
    modelChanged(): Observable<U>; // broadcast all changes of the underlying model
    updating(): boolean; // model is being updated and no events are propagated
    value(): U; // returns the model value
    history(): ModelHistory<U>[]; // returns history of changes
    historyPointIndex(): number; // returns current history point being applied, which changes when undoing and redoing
    historyLength(): number; // returns history length
    undo(opts: Partial<ModelActionOptions> = {}); // undo last change
    undoAll(opts: Partial<ModelActionOptions> = {}); // undo all changes
    redo(opts: Partial<ModelActionOptions> = {}); // redo next change
    redoAll(opts: Partial<ModelActionOptions> = {}); // redo all changes
    getPropertyValue<K extends keyof U>(key: K): any; // get a property value
    getPartialValue<K extends keyof U>(keys: K[]): Partial<U>; // get a model chunk
    update(value: Partial<U>, opts: Partial<ModelActionOptions> = {}); // update the model
    listen(observer: symbol, ownUpdates = false): Observable<U>; // listen to changes filtered by source.
    beginUpdate(); // start a update batch and hold update events
    endUpdate(opts: Partial<ModelActionOptions> = {}); // end update and flush pending events
}
```
Listening events using `listen()` allows to filter events. So that if the observer match the source, the source is not notified unless `ownUpdates` is set `true`.

Many methods accept extra options to change the default behavior.
```ts
interface ModelActionOptions {
    source: symbol; // source of action, if not set, internal source is used.
    emitEvent: boolean; // whether to emit events as result of the action
}
```
 ```ts
export class ModelPlayground {

  public static play() {
    const listener = Symbol('listener');
    const source = Symbol('source');
    const service = new AppModelService();
    service.listen(listener).subscribe(event => {
      console.log('Model Changed', event);
    });

    // change model
    service.update({ name: 'Mary' }, {source});
    // sequence of changes
    service.beginUpdate();
    service.update({ name: 'Joseph'}, {source});
    service.update({lastname: 'Bosch'}, {source});
    service.update({createdAt: 4000}, {source});
    service.endUpdate();
    // get change history
    console.log('Change history:');
    console.table(service.history);
    // undo change
    service.undo();
    // undo all
    service.undoAll();
    // redo all
    service.redoAll();
    console.log('final name', service.getPropertyValue('name'));
    console.log('final partial value', service.getPartialValue(['name', 'lastname']));
  }
}
```

### Observable Property Changed
Similarly to `ModelChanged`, `PropertyChanged` can be extended by a custom model container and make any change observable. The different lays in that `PropertyChanged` observes properties one by one, even properties inside child objects.

```ts
import { PropertyChanged } from '@lapita/omens';

export class AppService extends PropertyChanged<AppModel> {
  constructor() {
    super(new AppModel());
  }
}

class AppModel {
  name = 'John';
  lastname = 'Connor';
  createdAt = 1000;
  address = {
    street: 'Big way',
    number: 3
  };
}
```

The `constructor` of `PropertyChanged` accepts extra options to modify its default behavior.

```ts
interface PropertyOptions {
    bufferTime: number; // pack update notification in bundle of n milliseconds
    omitOlderUpdates: boolean; // only propagate the most recent updates in a given update bundle. e.g.  [update(name = 'Tim') - update(name = 'Josh')], observer only receive update(name = 'Josh')] if this option is set true.
}
```
`PropertyChanged<AppModel>` passes the needed functionality to the model container that allows to interact with it and observe changes.

```ts
abstract class PropertyChanged<U extends any> {
    propertyChanged(): Observable<PropertyChangedEvent>; // notify any change
    value(): U; // returns the model value
    updating(): boolean; // indicates whether the model is being updated
    history(): PropertyHistory[]; // returns history of changes
    historyPointIndex(): number; // returns current history point
    historyLength(): number; // returns history length
    properties(): FlattenProperty[]; // returns a list of properties
    paths(): string[][]; // returns a list of the property paths
    undo(opts: Partial<PropertyActionOptions> = {}); // undo last change
    undoAll(opts: Partial<PropertyActionOptions> = {}); // undo all changes
    redo(opts: Partial<PropertyActionOptions> = {}); // redo last undo
    redoAll(opts: Partial<PropertyActionOptions> = {}); // redo all changes
    getPropertyValue(path: string | string[]): any; // get a specific property value
    setPropertyValue(path: string | string[], value: any, opts: Partial<PropertyActionOptions> = {}); // change a property value
    setPropertiesValue(data: Partial<U>, opts: Partial<PropertyActionOptions> = {}); // set the value of a collection of properties
    listen(observer: symbol, ownUpdates = false): Observable<PropertyChangedEvent>; // listen to updates
    beginUpdate(); // begin a batch of changes withholding events
    endUpdate(opts: Partial<PropertyActionOptions> = {}); // end current update batch and flush events
}
```
This example makes use of `PropertyChanged` to listen for any change and performing updates using two different source and listener identifiers.
```ts
import { AppPropertyService } from './app-property';

export class PropertyPlayground {

  public static play() {
    const listener = Symbol('listener');
    const source = Symbol('source');
    const service = new AppPropertyService();
    service.listen(listener).subscribe(event => {
      console.log('Changed', event);
    });

    // set a subset of properties
    console.log('->Set Name and Lastname');
    service.setPropertiesValue({name: 'Mary', lastname: 'Pills'}, {source});
    console.log('->Set CreatedAt');
    service.setPropertyValue('createdAt', 1200, {source});

    // redo the
    setTimeout(() => {
      console.log('->Undo');
      service.undo();
      console.log('history->', service.history);
    }, 20);
    setTimeout(() => {
      console.log('->Set Lastname');
      service.setPropertyValue('lastname', 'Bosch');
      console.log('history->', service.history);
    }, 40);

    setTimeout(() => {
      console.log('->Undo all');
      service.undoAll();
      console.log('history->', service.history);
    }, 60);
  }
}
```
