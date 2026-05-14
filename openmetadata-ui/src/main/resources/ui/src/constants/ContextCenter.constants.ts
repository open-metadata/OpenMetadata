/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
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
