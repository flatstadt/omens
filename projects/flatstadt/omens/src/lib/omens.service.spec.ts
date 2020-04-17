import { TestBed } from '@angular/core/testing';

import { OmensService } from './omens.service';

describe('OmensService', () => {
  let service: OmensService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OmensService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
