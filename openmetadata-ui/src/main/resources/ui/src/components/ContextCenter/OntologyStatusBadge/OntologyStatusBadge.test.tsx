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
import { OntologyProcessingStatus } from '../../../generated/entity/context/contextMemory';
import OntologyStatusBadge from './OntologyStatusBadge.component';

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

describe('OntologyStatusBadge', () => {
  it('renders nothing when status is undefined', () => {
    const { container } = render(<OntologyStatusBadge />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an unknown status value', () => {
    const { container } = render(
      <OntologyStatusBadge
        status={'FutureStatus' as OntologyProcessingStatus}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the derivation error as a tooltip on a Failed badge', () => {
    render(
      <OntologyStatusBadge
        error="LLM provider timeout"
        status={OntologyProcessingStatus.Failed}
      />
    );

    expect(screen.getByTestId('tooltip')).toHaveAttribute(
      'data-tooltip-title',
      'LLM provider timeout'
    );
  });

  it('renders no tooltip on a Processed badge', () => {
    render(<OntologyStatusBadge status={OntologyProcessingStatus.Processed} />);

    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-status-badge')).toHaveTextContent(
      'label.processed'
    );
  });

  it.each([
    [OntologyProcessingStatus.Queued, 'label.queued', 'gray'],
    [OntologyProcessingStatus.Processing, 'label.processing', 'blue'],
    [OntologyProcessingStatus.Processed, 'label.processed', 'success'],
    [OntologyProcessingStatus.Failed, 'label.failed', 'error'],
  ])('renders %s with label %s and color %s', (status, label, color) => {
    render(<OntologyStatusBadge status={status} />);

    const badge = screen.getByTestId('ontology-status-badge');

    expect(badge).toHaveTextContent(label);
    expect(badge.querySelector('[data-color]')).toHaveAttribute(
      'data-color',
      color
    );
  });
});
