import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReminderDetails } from './reminder-details';

describe('ReminderDetails', () => {
  let component: ReminderDetails;
  let fixture: ComponentFixture<ReminderDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReminderDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReminderDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
