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

describe('DocumentStatusBadge', () => {
  it('renders nothing when status is undefined', () => {
    const { container } = render(<DocumentStatusBadge />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an unknown status value', () => {
    const { container } = render(
      <DocumentStatusBadge status={'FutureStatus' as ProcessingStatus} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the processing error as a tooltip on a Failed badge', () => {
    render(
      <DocumentStatusBadge
        error="provider exploded"
        status={ProcessingStatus.Failed}
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
        stats={{ chunksProcessed: 8, chunksTotal: 12 }}
        status={ProcessingStatus.Processed}
      />
    );

    expect(screen.getByTestId('tooltip')).toHaveAttribute(
      'data-tooltip-title',
      'message.extracted-from-chunk-count'
    );
  });

  it('renders no tooltip when extraction covered every chunk', () => {
    render(
      <DocumentStatusBadge
        stats={{ chunksProcessed: 12, chunksTotal: 12 }}
        status={ProcessingStatus.Processed}
      />
    );

    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
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
    render(<DocumentStatusBadge status={status} />);

    const badge = screen.getByTestId('document-status-badge');

    expect(badge).toHaveTextContent(label);
    expect(badge.querySelector('[data-color]')).toHaveAttribute(
      'data-color',
      color
    );
  });
});
