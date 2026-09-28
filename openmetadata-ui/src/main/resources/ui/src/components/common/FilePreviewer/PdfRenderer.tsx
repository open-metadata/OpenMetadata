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

import { Typography } from '@openmetadata/ui-core-components';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';
import { TFunction, useTranslation } from 'react-i18next';
import { PreviewRendererProps } from './FilePreviewer.types';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

const MAX_PDF_PREVIEW_PAGES = 50;

const isRenderingCancelledError = (error: unknown): boolean =>
  error instanceof pdfjsLib.RenderingCancelledException;

// Render one page onto a fresh canvas appended to the container.
const renderPageToCanvas = async (
  page: pdfjsLib.PDFPageProxy,
  container: HTMLDivElement,
  compact?: boolean
): Promise<void> => {
  const viewport = page.getViewport({ scale: 1.3 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.className = compact
    ? 'tw:mx-auto tw:max-w-full tw:h-auto'
    : 'tw:mx-auto tw:mb-4 tw:shadow-xs';
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  container.appendChild(canvas);
  await page.render({ canvasContext: ctx, viewport }).promise;
};

// Full view caps the render at MAX pages and notes the truncation; the compact
// miniature only ever shows the first page, so it needs no notice.
const maybeAppendPageLimitNotice = (
  doc: pdfjsLib.PDFDocumentProxy,
  container: HTMLDivElement,
  compact: boolean | undefined,
  t: TFunction
): void => {
  if (compact || doc.numPages <= MAX_PDF_PREVIEW_PAGES) {
    return;
  }
  const notice = document.createElement('div');
  notice.className = 'tw:text-center tw:text-sm tw:text-secondary tw:p-4';
  notice.textContent = t('message.file-preview-pdf-page-limit', {
    count: MAX_PDF_PREVIEW_PAGES,
  });
  container.appendChild(notice);
};

const PdfRenderer = ({ compact, content }: PreviewRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let destroyed = false;
    let doc: pdfjsLib.PDFDocumentProxy | undefined;
    const container = containerRef.current;

    // Guards against destroying twice: cleanup may run before `doc` exists
    // (document still loading), in which case it is a no-op here and the
    // in-flight `renderPdf` call destroys it once loading finishes instead.
    const destroyDoc = () => {
      if (destroyed || !doc) {
        return;
      }
      destroyed = true;
      doc.destroy();
    };

    const renderPdf = async () => {
      const data = await content.arrayBuffer();
      // isEvalSupported: false and disableAutoFetch: true are load-bearing —
      // untrusted PDFs must not execute embedded JS or fetch external resources.
      doc = await pdfjsLib.getDocument({
        data,
        disableAutoFetch: true,
        isEvalSupported: false,
      }).promise;
      if (cancelled) {
        // The consumer navigated away/unmounted while the document was still
        // loading — nothing destroyed it yet, so do it now to free the worker.
        destroyDoc();

        return;
      }
      if (!container) {
        return;
      }
      container.replaceChildren();
      const pagesToRender = compact
        ? 1
        : Math.min(doc.numPages, MAX_PDF_PREVIEW_PAGES);
      for (let pageNo = 1; pageNo <= pagesToRender; pageNo++) {
        const page = await doc.getPage(pageNo);
        if (cancelled || !container) {
          return;
        }
        await renderPageToCanvas(page, container, compact);
      }
      maybeAppendPageLimitNotice(doc, container, compact, t);
    };

    renderPdf().catch((error) => {
      // A cancellation (unmount mid-render, or pdf.js aborting `page.render`
      // when `doc.destroy()` runs concurrently) is expected teardown, not a
      // failure — surface only genuine parse/render errors.
      if (cancelled || isRenderingCancelledError(error)) {
        return;
      }
      setHasError(true);
    });

    return () => {
      cancelled = true;
      destroyDoc();
    };
  }, [compact, content, t]);

  if (hasError) {
    return (
      <div data-testid="pdf-preview-error">
        <Typography className="tw:p-8 tw:text-center" color="secondary">
          {t('message.file-preview-render-failed')}
        </Typography>
      </div>
    );
  }

  return <div className={compact ? '' : 'tw:p-4'} ref={containerRef} />;
};

export default PdfRenderer;
