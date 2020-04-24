import { Component } from '@angular/core';

import { PropertyPlayground } from './property-changed/playground';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
})
export class AppComponent {
    constructor() {
        // MessengerPlayground.play();
        // ModelPlayground.play();
        PropertyPlayground.play();
    }
}
