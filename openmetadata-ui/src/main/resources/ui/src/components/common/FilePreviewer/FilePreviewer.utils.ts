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
import { PreviewRendererId, ResolveRendererArgs } from './FilePreviewer.types';

const isMarkdown = (ext?: string, mime?: string): boolean =>
  ext === 'md' || ext === 'markdown' || mime === 'text/markdown';

// Mirror of the backend ContextFileUploadSupport.detectFileType classifier, used
// only when the entity did not carry a fileType. Same vocabulary and evaluation
// order as the backend, expressed as a rule table to stay under the complexity
// budget rather than a long if/else chain.
const MIME_RULES: { test: (mime: string) => boolean; type: FileType }[] = [
  { test: (mime) => mime === 'application/pdf', type: FileType.PDF },
  {
    test: (mime) => mime.includes('spreadsheet') || mime.includes('excel'),
    type: FileType.Spreadsheet,
  },
  {
    test: (mime) =>
      mime.includes('presentation') || mime.includes('powerpoint'),
    type: FileType.Presentation,
  },
  { test: (mime) => mime.startsWith('image/'), type: FileType.Image },
  {
    test: (mime) => mime === 'text/csv' || mime === 'application/csv',
    type: FileType.CSV,
  },
  {
    test: (mime) => mime.includes('document') || mime.includes('word'),
    type: FileType.Document,
  },
  { test: (mime) => mime.startsWith('text/'), type: FileType.Text },
];

const classifyByMime = (mime?: string): FileType => {
  if (!mime) {
    return FileType.Other;
  }

  return MIME_RULES.find((rule) => rule.test(mime))?.type ?? FileType.Other;
};

export const resolveRenderer = ({
  fileType,
  fileExtension,
  mimeType,
}: ResolveRendererArgs): PreviewRendererId => {
  const ext = fileExtension?.toLowerCase().replace(/^\./, '');
  const mime = mimeType?.toLowerCase();
  const type = fileType ?? classifyByMime(mime);

  switch (type) {
    case FileType.PDF:
      return PreviewRendererId.Pdf;
    case FileType.Image:
      return PreviewRendererId.Image;
    case FileType.Text:
      return isMarkdown(ext, mime)
        ? PreviewRendererId.Markdown
        : PreviewRendererId.Text;
    case FileType.CSV:
      return PreviewRendererId.Text;
    default:
      return PreviewRendererId.Unsupported;
  }
};
