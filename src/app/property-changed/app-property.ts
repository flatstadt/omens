import { PropertyChanged } from '@lapita/omens';

export class AppPropertyService extends PropertyChanged<AppModel> {
  constructor() {
    super(new AppModel());
  }
}

class AppModel {
  name = 'John';
  lastname = 'Connor';
  createdAt = 1000;
}
