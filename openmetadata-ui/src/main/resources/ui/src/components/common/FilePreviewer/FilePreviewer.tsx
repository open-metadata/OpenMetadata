/*
 *  Copyright OpenMetadata Collective SPDX-License-Identifier: Apache-2.0
 */

import { lazy, useEffect, useMemo } from 'react';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import {
  FilePreviewerProps,
  PreviewRendererId,
} from './FilePreviewer.interface';
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
  fileExtension,
  fileName,
  mimeType,
}: FilePreviewerProps) => {
  const objectUrl = useMemo(() => URL.createObjectURL(content), [content]);

  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  const Renderer = RENDERERS[resolveRenderer({ fileExtension, mimeType })];

  return (
    <Renderer content={content} fileName={fileName} objectUrl={objectUrl} />
  );
};

export default FilePreviewer;
