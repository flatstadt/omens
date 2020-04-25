import { PropertyChanged } from '@lapita/omens';

export class AppPropertyService extends PropertyChanged<AppModel> {
  constructor() {
    super(new AppModel(), {bufferTime: 1000});
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
