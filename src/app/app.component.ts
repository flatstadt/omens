import {Component} from '@angular/core';
import {MessengerPlayground} from './messenger/playground';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor() {
    MessengerPlayground.play();
  }
}


