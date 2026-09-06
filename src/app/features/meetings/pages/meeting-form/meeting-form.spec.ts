import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeetingForm } from './meeting-form';

describe('MeetingForm', () => {
  let component: MeetingForm;
  let fixture: ComponentFixture<MeetingForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeetingForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeetingForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
