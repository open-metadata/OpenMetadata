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

import { PreviewRendererId, ResolveRendererArgs } from './FilePreviewer.interface';

const EXTENSION_MAP: Record<string, PreviewRendererId> = {
  md: PreviewRendererId.Markdown,
  markdown: PreviewRendererId.Markdown,
  txt: PreviewRendererId.Text,
  pdf: PreviewRendererId.Pdf,
  png: PreviewRendererId.Image,
  jpg: PreviewRendererId.Image,
  jpeg: PreviewRendererId.Image,
  gif: PreviewRendererId.Image,
  webp: PreviewRendererId.Image,
};

const resolveByMime = (mimeType: string): PreviewRendererId => {
  const mime = mimeType.toLowerCase();
  if (mime === 'application/pdf') {
    return PreviewRendererId.Pdf;
  }
  if (mime === 'text/markdown') {
    return PreviewRendererId.Markdown;
  }
  if (['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mime)) {
    return PreviewRendererId.Image;
  }
  if (mime.startsWith('text/')) {
    return PreviewRendererId.Text;
  }

  return PreviewRendererId.Unsupported;
};

export const resolveRenderer = ({
  fileExtension,
  mimeType,
}: ResolveRendererArgs): PreviewRendererId => {
  const ext = fileExtension?.toLowerCase().replace(/^\./, '');
  if (ext && EXTENSION_MAP[ext]) {
    return EXTENSION_MAP[ext];
  }
  if (mimeType) {
    return resolveByMime(mimeType);
  }

  return PreviewRendererId.Unsupported;
};
