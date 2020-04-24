import { AppPropertyService } from './app-property';

export class PropertyPlayground {

  public static play() {
    const listener = Symbol('listener');
    const source = Symbol('source');
    const service = new AppPropertyService();
    service.listen(source).subscribe(event => {
      console.log('Property Changed', event);
    });

    service.setPropertyValue('name', 'Leon', {source});
    service.setPropertyValue('lastname', 'Bosch');


  }
}
