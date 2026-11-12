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
import { ProcessingStatus } from '../../../generated/entity/data/contextFile';
import DocumentStatusBadge from './DocumentStatusBadge.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  BadgeWithDot: jest.fn(
    ({ children, color }: { children: React.ReactNode; color: string }) => (
      <span data-color={color}>{children}</span>
    )
  ),
  Tooltip: jest.fn(
    ({ children, title }: { children: React.ReactNode; title: string }) => (
      <span data-testid="tooltip" data-tooltip-title={title}>
        {children}
      </span>
    )
  ),
  TooltipTrigger: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const extractedFile = {
  extractionStats: { chunksProcessed: 12, chunksTotal: 12, pillsCreated: 3 },
  neverExtracted: false,
  processingStatus: ProcessingStatus.Processed,
};

describe('DocumentStatusBadge', () => {
  it('renders nothing when status is undefined', () => {
    const { container } = render(<DocumentStatusBadge file={{}} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an unknown status value', () => {
    const { container } = render(
      <DocumentStatusBadge
        file={{ processingStatus: 'FutureStatus' as ProcessingStatus }}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the processing error as a tooltip on a Failed badge', () => {
    render(
      <DocumentStatusBadge
        file={{
          processingError: 'provider exploded',
          processingStatus: ProcessingStatus.Failed,
        }}
      />
    );

    expect(screen.getByTestId('tooltip')).toHaveAttribute(
      'data-tooltip-title',
      'provider exploded'
    );
  });

  it('shows partial chunk coverage as a tooltip on a Processed badge', () => {
    render(
      <DocumentStatusBadge
        file={{
          ...extractedFile,
          extractionStats: { chunksProcessed: 8, chunksTotal: 12 },
        }}
      />
    );

    expect(screen.getByTestId('tooltip')).toHaveAttribute(
      'data-tooltip-title',
      'message.extracted-from-chunk-count'
    );
  });

  it('renders no tooltip when extraction covered every chunk', () => {
    render(<DocumentStatusBadge file={extractedFile} />);

    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
    expect(screen.getByTestId('document-status-badge')).toHaveTextContent(
      'label.processed'
    );
  });

  it('shows Not processed when the server reports the file was never extracted', () => {
    render(
      <DocumentStatusBadge
        file={{
          neverExtracted: true,
          processingStatus: ProcessingStatus.Processed,
        }}
      />
    );

    const badge = screen.getByTestId('document-status-badge');

    expect(badge).toHaveTextContent('label.not-processed');
    expect(badge.querySelector('[data-color]')).toHaveAttribute(
      'data-color',
      'gray'
    );
  });

  it('keeps Processed when the server reports the file was extracted', () => {
    render(
      <DocumentStatusBadge
        file={{
          neverExtracted: false,
          processingStatus: ProcessingStatus.Processed,
        }}
      />
    );

    expect(screen.getByTestId('document-status-badge')).toHaveTextContent(
      'label.processed'
    );
  });

  // The server owns the rule: a file that looks never extracted stays Processed without the flag.
  it('does not work out Not processed from the file itself', () => {
    const looksNeverExtracted = {
      headContentId: 'content-1',
      processingStatus: ProcessingStatus.Processed,
    };

    render(<DocumentStatusBadge file={looksNeverExtracted} />);

    expect(screen.getByTestId('document-status-badge')).toHaveTextContent(
      'label.processed'
    );
  });

  it.each([
    [ProcessingStatus.Uploaded, 'label.uploaded', 'gray'],
    [ProcessingStatus.Analyzing, 'label.analyzing', 'blue'],
    [ProcessingStatus.ExtractingContext, 'label.extracting-context', 'indigo'],
    [ProcessingStatus.Processed, 'label.processed', 'success'],
    [ProcessingStatus.Failed, 'label.failed', 'error'],
    [ProcessingStatus.Unsupported, 'label.unsupported', 'warning'],
  ])('renders %s with label %s and color %s', (status, label, color) => {
    render(<DocumentStatusBadge file={{ processingStatus: status }} />);

    const badge = screen.getByTestId('document-status-badge');

    expect(badge).toHaveTextContent(label);
    expect(badge.querySelector('[data-color]')).toHaveAttribute(
      'data-color',
      color
    );
  });
});
