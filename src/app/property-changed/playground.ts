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
