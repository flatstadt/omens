import { ModelChanged } from '../../observable/model-changed';

import createSpy = jasmine.createSpy;
interface PropertyMock {
  name: string;
  address: {
    street: string;
    number: number;
  };
}

class PropertyServiceMock extends ModelChanged<PropertyMock> {
  constructor() {
    super({name: 'Matt', address: {street: 'Boulevar', number: 1}});
  }
}

describe('Omens: PropertyChanged', () => {

  let service: PropertyServiceMock;

  beforeEach(() => {
    service = new PropertyServiceMock();
  });

  it('should have one history entry', () => {

  });

});
