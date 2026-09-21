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

import { render, waitFor } from '@testing-library/react';
import PdfRenderer from './PdfRenderer';

const getDocument = jest.fn();

jest.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (opts: unknown) => getDocument(opts),
}));

jest.mock(
  'pdfjs-dist/build/pdf.worker.min.mjs?url',
  () => 'worker-url',
  { virtual: true }
);

describe('PdfRenderer', () => {
  beforeEach(() => {
    const page = {
      getViewport: () => ({ width: 100, height: 100 }),
      render: () => ({ promise: Promise.resolve() }),
    };
    getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: () => Promise.resolve(page),
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
});
