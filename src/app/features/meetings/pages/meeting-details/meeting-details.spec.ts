import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeetingDetails } from './meeting-details';

describe('MeetingDetails', () => {
  let component: MeetingDetails;
  let fixture: ComponentFixture<MeetingDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeetingDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeetingDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
