import type { TaskAttachment } from '../../../core/models/task.model';

export const MAX_TASK_ATTACHMENT_SIZE = 4 * 1024 * 1024;
export const TASK_ATTACHMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp,.svg,' +
  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,' +
  'image/jpeg,image/png,image/gif,image/webp,image/svg+xml';

const TASK_ATTACHMENT_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'
]);

export function isSupportedTaskAttachment(file: Pick<File, 'name'>): boolean {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  return TASK_ATTACHMENT_EXTENSIONS.has(extension);
}

export function taskAttachmentIcon(fileName: string): string {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (extension === '.pdf') return 'fa-solid fa-file-pdf';
  if (['.doc', '.docx'].includes(extension)) return 'fa-solid fa-file-word';
  if (['.xls', '.xlsx', '.csv'].includes(extension)) return 'fa-solid fa-file-excel';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(extension)) {
    return 'fa-solid fa-file-image';
  }
  return 'fa-solid fa-file';
}

export function isImageTaskAttachment(attachment: TaskAttachment): boolean {
  return attachment.mimeType.startsWith('image/');
}
