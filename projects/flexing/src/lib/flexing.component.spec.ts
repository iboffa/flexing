import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlexingComponent } from './flexing.component';

describe('FlexingComponent', () => {
  let component: FlexingComponent;
  let fixture: ComponentFixture<FlexingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FlexingComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FlexingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
