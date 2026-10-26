import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api.config';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationService);
    http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_BASE_URL}/notifications`).flush([]);
  });

  afterEach(() => http.verify());

  it('resolves a request notification to its detail page', () => {
    expect(service.resourceRoute({
      id: 'notification-1',
      title: 'Request approved',
      message: 'Request updated',
      type: 'REQUEST',
      priority: 'MEDIUM',
      isRead: false,
      createdAt: '2026-10-26T09:00:00.000Z',
      referenceId: 'request-1',
    })).toBe('/requests/request-1');
  });
});
