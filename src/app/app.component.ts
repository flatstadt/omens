import { AfterViewInit, Component } from '@angular/core';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
})
export class AppComponent implements AfterViewInit {
    constructor() {}
    ngAfterViewInit(): void {
        // MessengerPlayground.play();
        // ModelPlayground.play();
        // PropertyPlayground.play();
    }
}
