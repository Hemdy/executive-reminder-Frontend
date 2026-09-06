import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeetingList } from './meeting-list';

describe('MeetingList', () => {
  let component: MeetingList;
  let fixture: ComponentFixture<MeetingList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeetingList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeetingList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
