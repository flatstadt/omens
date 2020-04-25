import { ModelChanged } from '../../observable/model-changed';

import createSpy = jasmine.createSpy;
interface ModelMock {
  name: string;
}

class ModelServiceMock extends ModelChanged<ModelMock> {
  constructor() {
    super({name: 'Matt'});
  }
}

describe('Omens: ModelChanged', () => {

  let service: ModelServiceMock;

  beforeEach(() => {
    service = new ModelServiceMock();
  });

  it('should have one history entry', () => {
    expect(service.history.length).toBe(1);
  });

  it('should increase history', () => {
    service.update({name: 'Leon'});
    expect(service.history.length).toBe(2);
  });

  it('should call listener', () => {
    const spyFcn = createSpy('subscription', () => {});
    service.listen(Symbol()).subscribe(spyFcn);
    service.update({name: 'Leon'}, {source: Symbol()});
    expect(spyFcn).toHaveBeenCalled();
  });

  it('should not callback source', () => {
    const source = Symbol();
    const spyFcn = createSpy('subscription', () => {});
    service.listen(source).subscribe(spyFcn);
    service.update({name: 'Leon'}, {source});
    expect(spyFcn).not.toHaveBeenCalled();
  });

  it('should callback source', () => {
    const source = Symbol();
    const spyFcn = createSpy('subscription', () => {});
    service.listen(source, true).subscribe(spyFcn);
    service.update({name: 'Leon'}, {source});
    expect(spyFcn).toHaveBeenCalled();
  });

  it('should undo', () => {
    service.update({name: 'Leon'});
    service.undo();
    expect(service.value.name).toBe('Matt');
  });

  it('should redo', () => {
    service.update({name: 'Leon'});
    service.update({name: 'Josh'});
    service.undo();
    service.undo();
    service.redo();
    expect(service.value.name).toBe('Leon');
  });

  it('should undo all', () => {
    service.update({name: 'Leon'});
    service.update({name: 'Josh'});
    service.undoAll();
    expect(service.value.name).toBe('Matt');
  });

  it('should redo all', () => {
    service.update({name: 'Leon'});
    service.update({name: 'Josh'});
    service.undoAll();
    service.redoAll();
    expect(service.value.name).toBe('Josh');
  });

  it('should count number of changes', () => {
    service.update({name: 'Leon'});
    service.update({name: 'Josh'});
    expect(service.historyLength).toBe(3);
  });

  it('should callback source twice', () => {
    const source = Symbol();
    const spyFcn = createSpy('subscription', () => {});
    service.listen(source, true).subscribe(spyFcn);
    service.update({name: 'Leon'}, {source});
    service.update({name: 'Josh'}, {source});
    expect(spyFcn).toHaveBeenCalledTimes(2);
  });

  it('should callback one', () => {
    const source = Symbol();
    const spyFcn = createSpy('subscription', () => {});
    service.listen(source, true).subscribe(spyFcn);
    service.beginUpdate();
    service.update({name: 'Leon'}, {source});
    service.update({name: 'Josh'}, {source});
    service.endUpdate();
    expect(spyFcn).toHaveBeenCalledTimes(1);
  });

  it('should create history', () => {
    service.update({name: 'Leon'});
    service.update({name: 'Josh'});
    const history = service.history;
    expect(history[0].value.name).toBe('Matt');
    expect(history[1].value.name).toBe('Leon');
  });
});
