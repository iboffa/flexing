import { TestBed } from '@angular/core/testing';

import { FlexingService } from './flexing.service';

describe('FlexingService', () => {
  let service: FlexingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FlexingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
