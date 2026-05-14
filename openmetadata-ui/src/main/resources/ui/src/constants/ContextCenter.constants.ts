// ─── File type badge ──────────────────────────────────────────────────────────

import { DocFileType } from 'components/ContextCenter/DocumentsView/DocumentsView.interface';

export const FILE_TYPE_STYLES: Record<
  DocFileType,
  { label: string; bg: string; text: string }
> = {
  csv: { bg: 'tw:bg-green-100', label: 'CSV', text: 'tw:text-green-700' },
  doc: { bg: 'tw:bg-blue-100', label: 'DOC', text: 'tw:text-blue-700' },
  image: { bg: 'tw:bg-gray-100', label: 'IMG', text: 'tw:text-gray-600' },
  other: { bg: 'tw:bg-gray-100', label: 'FILE', text: 'tw:text-gray-600' },
  pdf: { bg: 'tw:bg-red-100', label: 'PDF', text: 'tw:text-red-700' },
  xls: { bg: 'tw:bg-green-100', label: 'XLSX', text: 'tw:text-green-700' },
};

export const DOCUMENT_MAX_FILE_SIZE = 5 * 1024 * 1024;
