import { AppModelService } from './app-model';

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
