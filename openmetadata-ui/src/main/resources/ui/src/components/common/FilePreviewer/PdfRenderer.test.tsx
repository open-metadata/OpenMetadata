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

import { render, screen, waitFor } from '@testing-library/react';
import * as pdfjsLib from 'pdfjs-dist';
import PdfRenderer from './PdfRenderer';

const getDocument = jest.fn();
const destroy = jest.fn();
const getPage = jest.fn();

jest.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  RenderingCancelledException: class RenderingCancelledException extends Error {},
  getDocument: (opts: unknown) => getDocument(opts),
}));

jest.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => 'worker-url', {
  virtual: true,
});

describe('PdfRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const page = {
      getViewport: () => ({ width: 100, height: 100 }),
      render: () => ({ promise: Promise.resolve() }),
    };
    getPage.mockResolvedValue(page);
    getDocument.mockReturnValue({
      promise: Promise.resolve({
        destroy,
        getPage,
        numPages: 1,
      }),
    });
  });

  it('loads the document with eval disabled', async () => {
    render(<PdfRenderer content={new Blob()} objectUrl="" />);

    await waitFor(() => expect(getDocument).toHaveBeenCalled());

    expect(getDocument.mock.calls[0][0]).toEqual(
      expect.objectContaining({ isEvalSupported: false })
    );
  });

  it('renders at most MAX_PDF_PREVIEW_PAGES pages and shows a notice for larger documents', async () => {
    getDocument.mockReturnValue({
      promise: Promise.resolve({
        destroy,
        getPage,
        numPages: 120,
      }),
    });

    render(<PdfRenderer content={new Blob()} objectUrl="" />);

    await waitFor(() => expect(getPage).toHaveBeenCalledTimes(50));

    expect(
      await screen.findByText('message.file-preview-pdf-page-limit')
    ).toBeInTheDocument();

    expect(getPage).toHaveBeenCalledTimes(50);
  });

  it('destroys the pdf document on unmount', async () => {
    const { unmount } = render(
      <PdfRenderer content={new Blob()} objectUrl="" />
    );

    await waitFor(() => expect(getDocument).toHaveBeenCalled());
    await waitFor(() => expect(getPage).toHaveBeenCalledTimes(1));

    unmount();

    await waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
  });

  it('destroys the document if unmounted before it finishes loading', async () => {
    let resolveDoc: (doc: unknown) => void = (_doc: unknown) => undefined;
    getDocument.mockReturnValue({
      promise: new Promise((resolve) => {
        resolveDoc = resolve;
      }),
    });

    const { unmount } = render(
      <PdfRenderer content={new Blob()} objectUrl="" />
    );

    await waitFor(() => expect(getDocument).toHaveBeenCalled());

    unmount();
    resolveDoc({ destroy, getPage, numPages: 1 });

    await waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
  });

  it('shows a fallback message instead of a blank modal when the document fails to load', async () => {
    const rejection = Promise.reject(new Error('bad pdf'));
    // Attach a no-op handler synchronously so Node doesn't flag this as an
    // unhandled rejection before PdfRenderer's own `await` catches it.
    rejection.catch(() => undefined);
    getDocument.mockReturnValue({ promise: rejection });

    render(<PdfRenderer content={new Blob()} objectUrl="" />);

    expect(await screen.findByTestId('pdf-preview-error')).toBeInTheDocument();
    expect(
      screen.getByText('message.file-preview-render-failed')
    ).toBeInTheDocument();
  });

  it('swallows a RenderingCancelledException without showing the error fallback', async () => {
    const renderRejection = Promise.reject(
      new pdfjsLib.RenderingCancelledException('cancelled', 0)
    );
    renderRejection.catch(() => undefined);
    const page = {
      getViewport: () => ({ width: 100, height: 100 }),
      render: () => ({ promise: renderRejection }),
    };
    getPage.mockResolvedValue(page);

    render(<PdfRenderer content={new Blob()} objectUrl="" />);

    await waitFor(() => expect(getPage).toHaveBeenCalled());

    expect(screen.queryByTestId('pdf-preview-error')).not.toBeInTheDocument();
  });
});
