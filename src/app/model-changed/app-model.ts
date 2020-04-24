import { ModelChanged } from '@lapita/omens';

export class AppModelService extends ModelChanged<AppModel> {
  constructor() {
    super(new AppModel());
  }
}

class AppModel {
  name = 'John';
  lastname = 'Connor';
  createdAt = 1000;
}
