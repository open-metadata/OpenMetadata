/*
 *  Copyright 2024 Collate.
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

import { FileType } from '../../../generated/entity/data/contextFile';

export interface FilePreviewerProps {
  content: Blob;
  mimeType?: string;
  fileExtension?: string;
  fileName?: string;
  fileType?: FileType;
  // Miniature mode for the detail-panel thumbnail: renderers show a compact,
  // fit-to-container view (e.g. PDF renders only its first page).
  compact?: boolean;
}

export interface PreviewRendererProps {
  content: Blob;
  objectUrl: string;
  fileName?: string;
  compact?: boolean;
}

export enum PreviewRendererId {
  Markdown = 'markdown',
  Text = 'text',
  Pdf = 'pdf',
  Image = 'image',
  Unsupported = 'unsupported',
}

export interface ResolveRendererArgs {
  fileType?: FileType;
  fileExtension?: string;
  mimeType?: string;
}
