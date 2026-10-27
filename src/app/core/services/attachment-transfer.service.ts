import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

export type AttachmentSaveResult = 'downloaded' | 'shared' | 'opened' | 'cancelled';

export interface AttachmentDownloadContext {
  isIos: boolean;
  popup: Window | null;
}

@Injectable({ providedIn: 'root' })
export class AttachmentTransferService {
  private readonly document = inject(DOCUMENT);

  prepareDownload(): AttachmentDownloadContext {
    const view = this.document.defaultView;
    if (!view) {
      return { isIos: false, popup: null };
    }
    const isIos = this.isIos(view.navigator.userAgent);
    const popup = isIos ? view.open('about:blank', '_blank') : null;
    if (popup) {
      popup.document.title = 'Preparing attachment';
      popup.document.body.textContent = 'Preparing your attachment…';
    }
    return { isIos, popup };
  }

  cancel(context: AttachmentDownloadContext): void {
    context.popup?.close();
  }

  async save(
    blob: Blob,
    fileName: string,
    context = this.prepareDownload(),
  ): Promise<AttachmentSaveResult> {
    const view = this.document.defaultView;
    if (!view) {
      this.cancel(context);
      throw new Error('File downloads are only available in a browser.');
    }

    const file = new view.File([blob], fileName, {
      type: blob.type || 'application/octet-stream',
    });
    const shareData: ShareData = { files: [file], title: fileName };
    const navigator = view.navigator;

    if (context.isIos && navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        this.cancel(context);
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          this.cancel(context);
          return 'cancelled';
        }
      }
    }

    const url = view.URL.createObjectURL(blob);
    if (context.popup && !context.popup.closed) {
      this.showOpenLink(context.popup, url, fileName);
      view.setTimeout(() => view.URL.revokeObjectURL(url), 120_000);
      return 'opened';
    }

    const link = this.document.createElement('a');
    link.href = url;
    if (context.isIos) {
      link.target = '_blank';
      link.rel = 'noopener';
    } else {
      link.download = fileName;
    }
    this.document.body.append(link);
    link.click();
    link.remove();
    view.setTimeout(() => view.URL.revokeObjectURL(url), 120_000);
    return context.isIos ? 'opened' : 'downloaded';
  }

  async failureMessage(error: unknown, action: 'upload' | 'download'): Promise<string> {
    if (!(error instanceof HttpErrorResponse)) {
      return `Unable to ${action} the attachment. Please try again.`;
    }
    if (error.status === 0) {
      return `Could not ${action} the attachment because the server is unreachable. Check your connection and retry.`;
    }

    const detail = await this.responseMessage(error.error);
    if (detail) {
      return `Unable to ${action} the attachment: ${detail}`;
    }
    if (error.status === 503) {
      return `The attachment service is unavailable (503). Check your connection and retry; the request was not completed.`;
    }
    return `Unable to ${action} the attachment (HTTP ${error.status}). Please try again.`;
  }

  private showOpenLink(popup: Window, url: string, fileName: string): void {
    const popupDocument = popup.document;
    popupDocument.open();
    popupDocument.write('<!doctype html><html><head></head><body></body></html>');
    popupDocument.title = 'Open attachment';

    const heading = popupDocument.createElement('h1');
    heading.textContent = 'Your attachment is ready';
    const instructions = popupDocument.createElement('p');
    instructions.textContent =
      'Tap the button below to open the file. On iPhone or iPad, use the Share button to save it to Files.';
    const link = popupDocument.createElement('a');
    link.href = url;
    link.download = fileName;
    link.textContent = `Open ${fileName}`;
    link.style.cssText =
      'display:inline-block;padding:12px 18px;border-radius:8px;background:#2457c5;color:#fff;text-decoration:none;font:600 16px system-ui,sans-serif';

    popupDocument.body.replaceChildren(heading, instructions, link);
    popupDocument.body.style.cssText =
      'max-width:640px;margin:12vh auto;padding:24px;color:#172033;font:16px/1.5 system-ui,sans-serif';
    popupDocument.close();
  }

  private async responseMessage(body: unknown): Promise<string | undefined> {
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message = body.message;
      return typeof message === 'string' ? message : undefined;
    }
    if (!(body instanceof Blob)) {
      return undefined;
    }

    const text = typeof body.text === 'function'
      ? await body.text()
      : await this.readBlobText(body);
    try {
      const parsed = JSON.parse(text) as { message?: unknown };
      return typeof parsed.message === 'string' ? parsed.message : undefined;
    } catch (error) {
      if (error instanceof SyntaxError) {
        return undefined;
      }
      throw error;
    }
  }

  private readBlobText(blob: Blob): Promise<string> {
    const view = this.document.defaultView;
    if (!view) {
      return Promise.reject(new Error('Cannot read the server response outside a browser.'));
    }

    return new Promise((resolve, reject) => {
      const reader = new view.FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read the server response.'));
      reader.readAsText(blob);
    });
  }

  private isIos(userAgent: string): boolean {
    const view = this.document.defaultView;
    return /iPad|iPhone|iPod/.test(userAgent) ||
      Boolean(view && /Macintosh/.test(userAgent) && view.navigator.maxTouchPoints > 1);
  }
}
