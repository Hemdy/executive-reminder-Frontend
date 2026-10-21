import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PushNotificationsService } from './core/services/push-notifications.service';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: PushNotificationsService,
          useValue: {},
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the startup loading overlay', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-loading-overlay')).toBeTruthy();
    expect(compiled.querySelector('.loading-overlay')?.classList.contains('is-visible')).toBe(true);
  });
});
