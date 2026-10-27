import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AttachmentTransferService } from './attachment-transfer.service';

describe('AttachmentTransferService', () => {
  let service: AttachmentTransferService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AttachmentTransferService);
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'canShare');
    Reflect.deleteProperty(navigator, 'share');
  });

  it('explains that a service-worker 503 did not complete the transfer', async () => {
    const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });

    await expect(service.failureMessage(error, 'upload')).resolves.toContain(
      'request was not completed',
    );
  });

  it('tells the user when the API could not be reached', async () => {
    const error = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });

    await expect(service.failureMessage(error, 'download')).resolves.toContain(
      'Check your connection',
    );
  });

  it('uses the iOS share sheet when it can share the downloaded file', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share,
    });

    const result = await service.save(
      new Blob(['attachment']),
      'report.pdf',
      { isIos: true, popup: null },
    );

    expect(result).toBe('shared');
    expect(share).toHaveBeenCalledOnce();
  });
});
