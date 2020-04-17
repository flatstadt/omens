import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { OmensComponent } from './omens.component';

describe('OmensComponent', () => {
  let component: OmensComponent;
  let fixture: ComponentFixture<OmensComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OmensComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OmensComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
