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
    return { isIos, popup: isIos ? view.open('about:blank', '_blank') : null };
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
      context.popup.location.href = url;
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
    if (error.status === 503) {
      return `The attachment service is unavailable (503). Check your connection and retry; the request was not completed.`;
    }

    const detail = await this.responseMessage(error.error);
    if (detail) {
      return `Unable to ${action} the attachment: ${detail}`;
    }
    return `Unable to ${action} the attachment (HTTP ${error.status}). Please try again.`;
  }

  private async responseMessage(body: unknown): Promise<string | undefined> {
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message = body.message;
      return typeof message === 'string' ? message : undefined;
    }
    if (!(body instanceof Blob)) {
      return undefined;
    }

    const text = await body.text();
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

  private isIos(userAgent: string): boolean {
    const view = this.document.defaultView;
    return /iPad|iPhone|iPod/.test(userAgent) ||
      Boolean(view && /Macintosh/.test(userAgent) && view.navigator.maxTouchPoints > 1);
  }
}
