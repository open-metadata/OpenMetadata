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

import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PreviewRendererProps } from './FilePreviewer.interface';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

const MAX_PDF_PREVIEW_PAGES = 50;

const PdfRenderer = ({ content }: PreviewRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    let doc: pdfjsLib.PDFDocumentProxy | undefined;
    const container = containerRef.current;

    const renderPdf = async () => {
      const data = await content.arrayBuffer();
      // isEvalSupported: false and disableAutoFetch: true are load-bearing —
      // untrusted PDFs must not execute embedded JS or fetch external resources.
      doc = await pdfjsLib.getDocument({
        data,
        disableAutoFetch: true,
        isEvalSupported: false,
      }).promise;
      if (cancelled || !container) {
        return;
      }
      container.replaceChildren();
      const pagesToRender = Math.min(doc.numPages, MAX_PDF_PREVIEW_PAGES);
      for (let pageNo = 1; pageNo <= pagesToRender; pageNo++) {
        const page = await doc.getPage(pageNo);
        if (cancelled || !container) {
          return;
        }
        const viewport = page.getViewport({ scale: 1.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = 'tw:mx-auto tw:mb-4 tw:shadow-xs';
        const ctx = canvas.getContext('2d');
        if (ctx) {
          container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      }
      if (!cancelled && container && doc.numPages > MAX_PDF_PREVIEW_PAGES) {
        const notice = document.createElement('div');
        notice.className = 'tw:text-center tw:text-sm tw:text-secondary tw:p-4';
        notice.textContent = t('message.file-preview-pdf-page-limit', {
          count: MAX_PDF_PREVIEW_PAGES,
        });
        container.appendChild(notice);
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
      doc?.destroy();
    };
  }, [content, t]);

  return <div className="tw:p-4" ref={containerRef} />;
};

export default PdfRenderer;
