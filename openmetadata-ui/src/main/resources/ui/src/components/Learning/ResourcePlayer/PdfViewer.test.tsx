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

import { render, screen } from '@testing-library/react';
import { LearningResource } from '../../../rest/learningResourceAPI';
import { PdfViewer } from './PdfViewer';

const PDF_URL = 'https://docs.example.com/data-seeker-guide.pdf';

const createPdfResource = (url: string): LearningResource => ({
  id: 'pdf-resource-1',
  name: 'DataSeekerGuide',
  displayName: 'Data Seeker Guide',
  resourceType: 'PDF',
  categories: ['Discovery'],
  source: { url },
  contexts: [{ pageId: 'domain' }],
});

describe('PdfViewer', () => {
  it('should embed the PDF in a frame titled with the resource name', () => {
    render(<PdfViewer resource={createPdfResource(PDF_URL)} />);

    const frame = screen.getByTitle('Data Seeker Guide');

    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', PDF_URL);
  });

  it('should not sandbox the frame since browsers disable their PDF viewer in sandboxed frames', () => {
    render(<PdfViewer resource={createPdfResource(PDF_URL)} />);

    expect(screen.getByTitle('Data Seeker Guide')).not.toHaveAttribute(
      'sandbox'
    );
  });

  it('should offer opening the PDF in a new tab for hosts that block embedding', () => {
    render(<PdfViewer resource={createPdfResource(PDF_URL)} />);

    const link = screen.getByRole('link', { name: 'label.open-in-new-tab' });

    expect(link).toHaveAttribute('href', PDF_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should neither embed nor link a non-web URL', () => {
    render(<PdfViewer resource={createPdfResource('javascript:alert(1)')} />);

    expect(screen.queryByTitle('Data Seeker Guide')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('label.invalid-url')).toBeInTheDocument();
  });
});
