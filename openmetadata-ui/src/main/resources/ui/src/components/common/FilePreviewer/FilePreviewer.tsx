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

import { lazy, useEffect, useState } from 'react';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { FilePreviewerProps, PreviewRendererId } from './FilePreviewer.types';
import { resolveRenderer } from './FilePreviewer.utils';
import ImageRenderer from './ImageRenderer';
import TextRenderer from './TextRenderer';
import UnsupportedRenderer from './UnsupportedRenderer';

const MarkdownRenderer = withSuspenseFallback(
  lazy(() => import('./MarkdownRenderer'))
);
const PdfRenderer = withSuspenseFallback(lazy(() => import('./PdfRenderer')));

const RENDERERS = {
  [PreviewRendererId.Markdown]: MarkdownRenderer,
  [PreviewRendererId.Text]: TextRenderer,
  [PreviewRendererId.Pdf]: PdfRenderer,
  [PreviewRendererId.Image]: ImageRenderer,
  [PreviewRendererId.Unsupported]: UnsupportedRenderer,
};

const FilePreviewer = ({
  content,
  compact,
  fileExtension,
  fileName,
  fileType,
  mimeType,
}: FilePreviewerProps) => {
  // Create and revoke the object URL in one effect so each mount owns the URL
  // it revokes. A useMemo + separate-cleanup split breaks under React
  // StrictMode's mount→cleanup→remount (the cleanup revokes the URL the
  // remount still points at, leaving a broken blob src).
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(content);
    setObjectUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [content]);

  const Renderer =
    RENDERERS[resolveRenderer({ fileExtension, fileType, mimeType })];

  if (!objectUrl) {
    return null;
  }

  return (
    <Renderer
      compact={compact}
      content={content}
      fileName={fileName}
      objectUrl={objectUrl}
    />
  );
};

export default FilePreviewer;
