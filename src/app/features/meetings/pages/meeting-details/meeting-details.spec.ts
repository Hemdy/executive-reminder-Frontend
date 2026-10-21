import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MeetingService } from '../../../../core/services/meeting.service';

import { MeetingDetails } from './meeting-details';

describe('MeetingDetails', () => {
  let component: MeetingDetails;
  let fixture: ComponentFixture<MeetingDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeetingDetails],
      providers: [
        provideRouter([]),
        {
          provide: MeetingService,
          useValue: { getMeeting: () => null },
        },
      ],
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
