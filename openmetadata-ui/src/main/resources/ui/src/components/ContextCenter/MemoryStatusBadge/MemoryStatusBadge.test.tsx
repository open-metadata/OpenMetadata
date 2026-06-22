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
import { MemoryProcessingStatus } from '../../../generated/entity/context/contextMemory';
import MemoryStatusBadge from './MemoryStatusBadge.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: jest.fn(
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

describe('MemoryStatusBadge', () => {
  it('renders nothing when status is undefined', () => {
    const { container } = render(<MemoryStatusBadge />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an unknown status value', () => {
    const { container } = render(
      <MemoryStatusBadge status={'FutureStatus' as MemoryProcessingStatus} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the derivation error as a tooltip on a Failed badge', () => {
    render(
      <MemoryStatusBadge
        error="LLM provider timeout"
        status={MemoryProcessingStatus.Failed}
      />
    );

    expect(screen.getByTestId('tooltip')).toHaveAttribute(
      'data-tooltip-title',
      'LLM provider timeout'
    );
  });

  it('renders no tooltip on a Processed badge', () => {
    render(<MemoryStatusBadge status={MemoryProcessingStatus.Processed} />);

    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
    expect(screen.getByTestId('memory-status-badge')).toHaveTextContent(
      'label.processed'
    );
  });

  it.each([
    [MemoryProcessingStatus.Queued, 'label.queued', 'gray'],
    [MemoryProcessingStatus.Processing, 'label.processing', 'blue'],
    [MemoryProcessingStatus.Processed, 'label.processed', 'success'],
    [MemoryProcessingStatus.Failed, 'label.failed', 'error'],
  ])('renders %s with label %s and color %s', (status, label, color) => {
    render(<MemoryStatusBadge status={status} />);

    const badge = screen.getByTestId('memory-status-badge');

    expect(badge).toHaveTextContent(label);
    expect(badge.querySelector('[data-color]')).toHaveAttribute(
      'data-color',
      color
    );
  });
});
