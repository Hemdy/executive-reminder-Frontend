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

  it('shows the backend reason for an unavailable attachment service', async () => {
    const error = new HttpErrorResponse({
      status: 503,
      error: new Blob([
        JSON.stringify({ message: 'Configure Supabase Storage for task attachments on the backend' }),
      ], { type: 'application/json' }),
    });

    await expect(service.failureMessage(error, 'upload')).resolves.toContain(
      'Configure Supabase Storage',
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
      { isIos: true, isMobile: true, popup: null },
    );

    expect(result).toBe('shared');
    expect(share).toHaveBeenCalledOnce();
  });

  it('starts a named browser download on desktop', async () => {
    const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: () => 'blob:attachment',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: () => {},
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      const result = await service.save(new Blob(['attachment']), 'report.pdf', {
        isIos: false,
        isMobile: false,
        popup: null,
      });

      expect(result).toBe('downloaded');
      expect(click).toHaveBeenCalledOnce();
    } finally {
      click.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL');
      }
    }
  });

  it('shows a user-activated file link instead of navigating Safari to a blob URL', async () => {
    const popupDocument = document.implementation.createHTMLDocument();
    const popup = {
      document: popupDocument,
      closed: false,
    } as Window;

    const result = await service.save(
      new Blob(['attachment'], { type: 'application/pdf' }),
      'report.pdf',
      { isIos: true, isMobile: true, popup },
    );

    expect(result).toBe('opened');
    expect(popupDocument.body.textContent).toContain('Tap the button below');
    expect(popupDocument.querySelector('a')?.textContent).toBe('Open report.pdf');
    expect(popupDocument.querySelector('a')?.download).toBe('report.pdf');
  });

  it('uses a user-activated file link for Android downloads', async () => {
    const popupDocument = document.implementation.createHTMLDocument();
    const popup = {
      document: popupDocument,
      closed: false,
    } as Window;
    const originalUserAgent = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as WindowProxy);

    try {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36',
      });
      const context = service.prepareDownload();

      expect(context.isMobile).toBe(true);
      expect(context.popup).toBe(popup);
      expect(open).toHaveBeenCalledWith('about:blank', '_blank');

      const result = await service.save(
        new Blob(['attachment'], { type: 'application/pdf' }),
        'report.pdf',
        context,
      );

      expect(result).toBe('opened');
      expect(popupDocument.querySelector('a')?.textContent).toBe('Open report.pdf');
      expect(popupDocument.querySelector('a')?.download).toBe('report.pdf');
    } finally {
      open.mockRestore();
      if (originalUserAgent) {
        Object.defineProperty(navigator, 'userAgent', originalUserAgent);
      } else {
        Reflect.deleteProperty(navigator, 'userAgent');
      }
    }
  });
});
