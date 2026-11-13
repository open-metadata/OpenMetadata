/*
 *  Copyright 2025 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { Decision } from '../../../generated/governance/workflows/approvalOutcome';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import { EntityStatusBadge } from './EntityStatusBadge.component';
import { getStatusChange } from './EntityStatusDecision.utils';

// Only the lookup is mocked; the wording runs for real.
jest.mock('./EntityStatusDecision.utils', () => ({
  ...jest.requireActual('./EntityStatusDecision.utils'),
  getStatusChange: jest.fn(),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  getShortRelativeTime: jest.fn().mockReturnValue('5 mins ago'),
}));

const hoverableBadge = () => (
  <EntityStatusBadge
    entityId="product-id"
    entityType="dataProduct"
    fqn="Finance.Invoices"
    showDivider={false}
    status={EntityStatus.Approved}
  />
);

const openPopover = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('entity-status-badge-trigger'));
  });
};

describe('EntityStatusBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render status badge with divider by default', () => {
    render(<EntityStatusBadge status={EntityStatus.Approved} />);

    expect(screen.getByText(EntityStatus.Approved)).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('should render status badge without divider when showDivider is false', () => {
    render(
      <EntityStatusBadge showDivider={false} status={EntityStatus.Draft} />
    );

    expect(screen.getByText(EntityStatus.Draft)).toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('should render all entity status types', () => {
    const statuses = [
      EntityStatus.Approved,
      EntityStatus.Draft,
      EntityStatus.InReview,
      EntityStatus.Rejected,
      EntityStatus.Deprecated,
      EntityStatus.Archived,
    ];

    statuses.forEach((status) => {
      const { unmount } = render(
        <EntityStatusBadge showDivider={false} status={status} />
      );

      expect(screen.getByText(status)).toBeInTheDocument();

      unmount();
    });
  });

  it('only looks up who set the status once the badge is hovered', async () => {
    (getStatusChange as jest.Mock).mockResolvedValue({
      status: 'Approved',
      changedAt: 1,
      workflowName: 'Data product approval',
      outcome: {
        id: 'outcome',
        node: 'Review',
        decision: Decision.Approved,
        decidedBy: ['ana.lopez', 'ben.carter'],
        decidedAt: 1,
      },
    });
    renderWithQueryClient(hoverableBadge());

    expect(getStatusChange).not.toHaveBeenCalled();

    await openPopover();

    expect(getStatusChange).toHaveBeenCalledWith(
      'dataProduct',
      'product-id',
      '<#E::dataProduct::Finance.Invoices>'
    );
    expect(
      await screen.findByTestId('entity-status-decision-outcome')
    ).toHaveTextContent('message.workflow-run-approved-by');
    expect(
      screen.getByTestId('entity-status-decision-detail')
    ).toHaveTextContent('Data product approval');
  });

  it('names the workflow and whose change started it when it set the status without an approval', async () => {
    (getStatusChange as jest.Mock).mockResolvedValue({
      status: 'In Review',
      changedAt: 1,
      workflowName: 'Data product lifecycle',
      triggeredBy: 'ana.lopez',
    });
    renderWithQueryClient(hoverableBadge());

    await openPopover();

    expect(
      await screen.findByTestId('entity-status-decision-outcome')
    ).toHaveTextContent('message.entity-status-set-by');
    expect(
      screen.getByTestId('entity-status-decision-detail')
    ).toHaveTextContent('message.entity-status-after-change-by');
  });

  it('names the person who set the status by hand', async () => {
    (getStatusChange as jest.Mock).mockResolvedValue({
      status: 'Deprecated',
      changedAt: 1,
      changedBy: 'ana.lopez',
    });
    renderWithQueryClient(hoverableBadge());

    await openPopover();

    expect(
      await screen.findByTestId('entity-status-decision-outcome')
    ).toHaveTextContent('message.entity-status-set-by');
    expect(
      screen.queryByTestId('entity-status-decision-detail')
    ).not.toBeInTheDocument();
  });

  it('looks the status up again once it changes on the page', async () => {
    (getStatusChange as jest.Mock).mockResolvedValue({
      status: 'In Review',
      changedAt: 1,
      changedBy: 'ana.lopez',
    });
    const { rerender } = renderWithQueryClient(hoverableBadge());
    await openPopover();
    await screen.findByTestId('entity-status-decision-outcome');

    rerender(
      <EntityStatusBadge
        entityId="product-id"
        entityType="dataProduct"
        fqn="Finance.Invoices"
        showDivider={false}
        status={EntityStatus.InReview}
      />
    );
    await openPopover();
    await openPopover();
    await screen.findByTestId('entity-status-decision-outcome');

    expect(getStatusChange).toHaveBeenCalledTimes(2);
  });

  it('renders a plain badge without a popover when it does not know the entity', () => {
    render(
      <EntityStatusBadge showDivider={false} status={EntityStatus.Draft} />
    );

    expect(
      screen.queryByTestId('entity-status-badge-trigger')
    ).not.toBeInTheDocument();
  });
});
