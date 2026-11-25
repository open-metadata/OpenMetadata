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
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { Decision } from '../../../generated/governance/workflows/approvalOutcome';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import { EntityStatusBadge } from './EntityStatusBadge.component';
import { getStatusChange } from './EntityStatusDecision.utils';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

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

// Keyboard focus opens the tooltip at once; a hover opens it after its delay. The badge is the
// only focusable element, so each Tab moves focus onto it or off it.
// Jest runs on fake timers, so user-event advances them itself.
const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
const toggleTooltip = () => user.tab();

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

    await toggleTooltip();

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

  it('describes the badge with the explanation, so screen readers announce it', async () => {
    (getStatusChange as jest.Mock).mockResolvedValue({
      status: 'Deprecated',
      changedAt: 1,
      changedBy: 'ana.lopez',
    });
    renderWithQueryClient(hoverableBadge());

    await toggleTooltip();
    await screen.findByTestId('entity-status-decision-outcome');

    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-describedby',
      screen.getByRole('tooltip').id
    );
  });

  it('names the workflow and whose change started it when it set the status without an approval', async () => {
    (getStatusChange as jest.Mock).mockResolvedValue({
      status: 'In Review',
      changedAt: 1,
      workflowName: 'Data product lifecycle',
      triggeredBy: 'ana.lopez',
    });
    renderWithQueryClient(hoverableBadge());

    await toggleTooltip();

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

    await toggleTooltip();

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
    await toggleTooltip();
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
    await screen.findByTestId('entity-status-decision-outcome');

    // The tooltip stays open; the new status is a new lookup, made once for title and description.
    expect(getStatusChange).toHaveBeenCalledTimes(2);
  });

  it('renders a plain badge without a tooltip when it does not know the entity', () => {
    render(
      <EntityStatusBadge showDivider={false} status={EntityStatus.Draft} />
    );

    expect(
      screen.queryByTestId('entity-status-badge-trigger')
    ).not.toBeInTheDocument();
  });

  it('shows a pending lifecycle request next to the stage', () => {
    render(
      <EntityStatusBadge
        requestedStage={EntityStatus.Deprecated}
        showDivider={false}
        status={EntityStatus.Approved}
      />
    );

    expect(screen.getByText(EntityStatus.Approved)).toBeInTheDocument();
    expect(screen.getByTestId('lifecycle-request-badge')).toHaveTextContent(
      'label.deprecation-requested'
    );
  });

  it('names a pending request for any other stage by the stage', () => {
    render(
      <EntityStatusBadge
        requestedStage={EntityStatus.Rejected}
        showDivider={false}
        status={EntityStatus.Approved}
      />
    );

    expect(screen.getByTestId('lifecycle-request-badge')).toHaveTextContent(
      'label.stage-requested'
    );
  });

  it('shows nothing for an Unprocessed asset with no pending request', () => {
    const { container } = render(
      <EntityStatusBadge status={EntityStatus.Unprocessed} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows only the pending request for an Unprocessed asset', () => {
    render(
      <EntityStatusBadge
        requestedStage={EntityStatus.Archived}
        showDivider={false}
        status={EntityStatus.Unprocessed}
      />
    );

    expect(screen.getByTestId('lifecycle-request-badge')).toBeInTheDocument();
    expect(
      screen.queryByText(EntityStatus.Unprocessed)
    ).not.toBeInTheDocument();
  });

  it('requests a stage the lifecycle offers with a reason, from the stage badge', async () => {
    const onRequest = jest.fn().mockResolvedValue(true);
    render(
      <EntityStatusBadge
        requestStages={[EntityStatus.Deprecated, EntityStatus.Archived]}
        showDivider={false}
        status={EntityStatus.Approved}
        onRequest={onRequest}
      />
    );

    await user.click(screen.getByTestId('entity-status-request-trigger'));

    expect(await screen.findByText('label.archive')).toBeInTheDocument();

    await user.click(screen.getByTestId('request-deprecated-button'));

    expect(
      await screen.findByTestId('status-request-modal')
    ).toBeInTheDocument();
    expect(screen.getByTestId('status-request-submit')).toBeDisabled();

    await user.type(
      screen.getByRole('textbox', { name: /label.reason/ }),
      'Replaced by Revenue'
    );
    await user.click(screen.getByTestId('status-request-submit'));

    expect(onRequest).toHaveBeenCalledWith(
      EntityStatus.Deprecated,
      'Replaced by Revenue'
    );
  });

  it('requests a move to any stage a transition leads to, such as back to Draft', async () => {
    const onRequest = jest.fn().mockResolvedValue(true);
    render(
      <EntityStatusBadge
        requestStages={[EntityStatus.Draft, EntityStatus.Deprecated]}
        showDivider={false}
        status={EntityStatus.Rejected}
        onRequest={onRequest}
      />
    );

    await user.click(screen.getByTestId('entity-status-request-trigger'));

    expect(await screen.findByTestId('request-draft-button')).toHaveTextContent(
      'label.move-to-stage'
    );

    await user.click(screen.getByTestId('request-draft-button'));
    await user.type(
      screen.getByRole('textbox', { name: /label.reason/ }),
      'Rework the definition'
    );
    await user.click(screen.getByTestId('status-request-submit'));

    expect(onRequest).toHaveBeenCalledWith(
      EntityStatus.Draft,
      'Rework the definition'
    );
  });

  it('titles the stage menu as a request, so picking a stage does not read as an instant change', async () => {
    render(
      <EntityStatusBadge
        requestStages={[EntityStatus.Deprecated]}
        showDivider={false}
        status={EntityStatus.Approved}
        onRequest={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('entity-status-request-trigger'));

    expect(
      await screen.findByTestId('entity-status-request-menu-header')
    ).toHaveTextContent('label.request-a-move');
    // The title is not an option of its own: only the offered stage is.
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(1);
  });

  it('shows each offered stage as its own badge next to the action', async () => {
    render(
      <EntityStatusBadge
        requestStages={[EntityStatus.Draft, EntityStatus.Archived]}
        showDivider={false}
        status={EntityStatus.Rejected}
        onRequest={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('entity-status-request-trigger'));

    const archive = await screen.findByTestId('request-archived-button');
    const draft = screen.getByTestId('request-draft-button');

    expect(within(archive).getByText('label.archive')).toBeInTheDocument();
    expect(
      within(archive).getByTestId('request-archived-stage-badge')
    ).toHaveTextContent(EntityStatus.Archived);
    expect(
      within(draft).getByTestId('request-draft-stage-badge')
    ).toHaveTextContent(EntityStatus.Draft);
  });

  it('opens the pending request and lets the requester withdraw it', async () => {
    const onWithdraw = jest.fn();
    render(
      <EntityStatusBadge
        requestTaskId="task-id"
        requestedStage={EntityStatus.Deprecated}
        showDivider={false}
        status={EntityStatus.Approved}
        onWithdraw={onWithdraw}
      />
    );

    await user.click(screen.getByTestId('lifecycle-request-trigger'));
    await user.click(await screen.findByTestId('withdraw-lifecycle-request'));

    expect(await screen.findByTestId('confirmation-modal')).toHaveTextContent(
      'message.withdraw-stage-request-confirm'
    );
    expect(onWithdraw).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('cancel'));

    expect(onWithdraw).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('lifecycle-request-trigger'));
    await user.click(await screen.findByTestId('withdraw-lifecycle-request'));
    await user.click(await screen.findByTestId('save-button'));

    expect(onWithdraw).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('lifecycle-request-trigger'));
    await user.click(await screen.findByTestId('view-lifecycle-request'));

    expect(mockNavigate).toHaveBeenCalledWith('/tasks/task-id');
  });

  it("opens the pending request selected in the asset's tasks tab", async () => {
    render(
      <EntityStatusBadge
        entityType="dataProduct"
        fqn="Finance.Invoices"
        requestTaskId="task-id"
        requestedStage={EntityStatus.Deprecated}
        showDivider={false}
        status={EntityStatus.Approved}
      />
    );

    await user.click(screen.getByTestId('lifecycle-request-trigger'));
    await user.click(await screen.findByTestId('view-lifecycle-request'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/dataProduct/Finance.Invoices/activity_feed/tasks?taskId=task-id'
    );
  });

  it('offers no withdraw on a request someone else raised', async () => {
    render(
      <EntityStatusBadge
        requestTaskId="task-id"
        requestedStage={EntityStatus.Deprecated}
        showDivider={false}
        status={EntityStatus.Approved}
      />
    );

    await user.click(screen.getByTestId('lifecycle-request-trigger'));

    expect(
      await screen.findByTestId('view-lifecycle-request')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('withdraw-lifecycle-request')
    ).not.toBeInTheDocument();
  });

  it('keeps a plain badge when the lifecycle takes no request', () => {
    render(
      <EntityStatusBadge
        requestStages={[]}
        showDivider={false}
        status={EntityStatus.Approved}
        onRequest={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('entity-status-request-trigger')
    ).not.toBeInTheDocument();
    expect(screen.getByText(EntityStatus.Approved)).toBeInTheDocument();
  });

  it('offers a request from an Unprocessed asset its lifecycle takes one from', () => {
    render(
      <EntityStatusBadge
        requestStages={[EntityStatus.Deprecated]}
        showDivider={false}
        status={EntityStatus.Unprocessed}
        onRequest={jest.fn()}
      />
    );

    expect(
      screen.getByTestId('entity-status-request-trigger')
    ).toBeInTheDocument();
  });
});
