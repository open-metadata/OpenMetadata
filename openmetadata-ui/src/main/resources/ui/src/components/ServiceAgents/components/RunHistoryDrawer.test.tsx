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

import { fireEvent, render, screen } from '@testing-library/react';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  Agent,
  AgentActionPermissions,
  AgentRun,
} from '../AgentsPage.interface';
import { useAgentRuns } from '../hooks/useAgentRuns';
import RunHistoryDrawer from './RunHistoryDrawer.component';

jest.mock('./RunStepRow.component', () =>
  jest.fn().mockImplementation(() => <p>RunStepRow</p>)
);

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  getUtcOffsetLabel: jest.fn().mockReturnValue('UTC+05:30'),
}));

const emptyTotals = {
  records: 0,
  filtered: 0,
  updated: 0,
  warnings: 0,
  errors: 0,
};

// `useAgentRuns` hands the drawer its runs oldest-first, so the rail reads left to right.
const mockRuns: AgentRun[] = [
  {
    id: 'run-oldest',
    status: 'partial',
    startedAt: 'May 25, 2026 · 08:10',
    duration: 4.1,
    totals: emptyTotals,
    steps: [],
  },
  {
    id: 'run-middle',
    status: 'failed',
    startedAt: 'May 26, 2026 · 08:10',
    duration: 0.7,
    totals: emptyTotals,
    steps: [],
  },
  {
    id: 'run-latest',
    status: 'success',
    startedAt: 'May 27, 2026 · 08:10',
    duration: 3.8,
    totals: emptyTotals,
    steps: [],
  },
];

const mockAirflowStatus = jest.fn();

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: () => mockAirflowStatus(),
  })
);

jest.mock('../hooks/useAgentRuns', () => ({
  useAgentRuns: jest.fn().mockImplementation(() => ({
    runs: mockRuns,
    isLoading: false,
  })),
}));

const agent: Agent = {
  id: 'agent-1',
  fqn: 'service.agent-1',
  pipelineType: PipelineType.Metadata,
  name: 'Metadata Agent',
  type: 'Metadata',
  unit: 'assets',
  verb: 'ingested',
  status: 'success',
  pct: 100,
  eta: 0,
  assets: 100,
  target: 100,
  errors: 0,
  warnings: 0,
  recentRuns: [],
};

const mockOnRun = jest.fn();

const TRIGGER_PERMISSION: AgentActionPermissions = {
  trigger: true,
  edit: false,
  delete: false,
};

const renderDrawer = (
  initialRunId?: string,
  agentOverrides?: Partial<Agent>,
  permissions: AgentActionPermissions = TRIGGER_PERMISSION
) =>
  render(
    <RunHistoryDrawer
      open
      agent={{ ...agent, ...agentOverrides }}
      initialRunId={initialRunId}
      permissions={permissions}
      onClose={jest.fn()}
      onOpenLogs={jest.fn()}
      onRun={mockOnRun}
    />
  );

describe('RunHistoryDrawer', () => {
  beforeEach(() => {
    mockAirflowStatus.mockReturnValue({
      isAirflowAvailable: true,
      isFetchingStatus: false,
      platform: 'Airflow',
    });
  });

  it.each([
    [
      'is still being fetched',
      { isAirflowAvailable: false, isFetchingStatus: true },
    ],
    [
      'reports it unreachable',
      { isAirflowAvailable: false, isFetchingStatus: false },
    ],
  ])(
    'should disable the pipeline-service controls while the status %s, keeping the run history',
    (_label, status) => {
      mockAirflowStatus.mockReturnValue({ ...status, platform: 'Airflow' });

      renderDrawer();

      expect(screen.getByTestId('raw-logs-button')).toBeDisabled();
      expect(screen.getByTestId('drawer-run-now-button')).toBeDisabled();
      expect(screen.getByTestId('run-history-drawer')).toBeInTheDocument();
    }
  );

  beforeEach(() => {
    mockOnRun.mockClear();
  });

  it('should pre-select the run matching initialRunId', () => {
    renderDrawer('run-middle');

    expect(
      screen.getByText(/May 26, 2026 · 08:10 \(UTC\+05:30\)/)
    ).toBeInTheDocument();
  });

  it('should select the latest run when no initialRunId is given', () => {
    renderDrawer();

    expect(
      screen.getByText(/May 27, 2026 · 08:10 \(UTC\+05:30\)/)
    ).toBeInTheDocument();
  });

  it('should fall back to the latest run for an unknown initialRunId', () => {
    renderDrawer('run-evicted');

    expect(
      screen.getByText(/May 27, 2026 · 08:10 \(UTC\+05:30\)/)
    ).toBeInTheDocument();
  });

  it('should trigger onRun when the Run now button is clicked', () => {
    renderDrawer();

    fireEvent.click(screen.getByText('label.run-now'));

    expect(mockOnRun).toHaveBeenCalledWith(agent);
  });

  it('should hide the Run now button for a running agent', () => {
    renderDrawer(undefined, { status: 'running' });

    expect(
      screen.queryByTestId('drawer-run-now-button')
    ).not.toBeInTheDocument();
  });

  it('should hide the Run now button for a queued agent to avoid a duplicate run', () => {
    renderDrawer(undefined, { status: 'queued' });

    expect(
      screen.queryByTestId('drawer-run-now-button')
    ).not.toBeInTheDocument();
  });

  it('should hide the Run now button without trigger permission', () => {
    renderDrawer(undefined, undefined, {
      trigger: false,
      edit: true,
      delete: true,
    });

    expect(
      screen.queryByTestId('drawer-run-now-button')
    ).not.toBeInTheDocument();
  });

  it('should hide the Run now button while permissions are unresolved', () => {
    render(
      <RunHistoryDrawer
        open
        agent={agent}
        onClose={jest.fn()}
        onOpenLogs={jest.fn()}
        onRun={mockOnRun}
      />
    );

    expect(
      screen.queryByTestId('drawer-run-now-button')
    ).not.toBeInTheDocument();
  });

  it('should forward fetchRuns to useAgentRuns', () => {
    const fetchRuns = jest.fn().mockResolvedValue([]);
    render(
      <RunHistoryDrawer
        open
        agent={agent}
        fetchRuns={fetchRuns}
        onClose={jest.fn()}
        onOpenLogs={jest.fn()}
        onRun={mockOnRun}
      />
    );

    expect(useAgentRuns).toHaveBeenCalledWith(agent.fqn, true, fetchRuns);
  });

  describe('header title', () => {
    it('should truncate a long agent name and keep it reachable through the ellipsis tooltip', () => {
      // The header is a fixed-width row shared with the action buttons, so a long
      // name has to clip rather than push them out. Clipping is only honest while
      // the full name stays readable, which core Typography delivers by wrapping
      // the text in a tooltip trigger. Hover itself belongs to core-components
      // (see its typography.test.tsx); asserting it here would re-test react-aria's
      // open/close timing rather than this drawer.
      const longName =
        'A very long metadata agent name that will not fit the drawer header';

      renderDrawer(undefined, { name: longName });

      const title = screen.getByText(longName);

      expect(title).toHaveClass('tw:truncate');
      expect(title.closest('button')).toBeInTheDocument();
    });
  });

  describe('agent link', () => {
    const agentLinkProps = {
      href: '/ai-automations/mysql_service_DescriptionAutomation',
      label: 'label.view-entity',
    };

    it('should render no link when the host has no detail page to point at', () => {
      // OpenMetadata's own agents have nowhere to link, so the header must stay
      // exactly as it was before the prop existed.
      renderDrawer();

      expect(screen.queryByTestId('agent-link-button')).not.toBeInTheDocument();
    });

    it('should render the agent link as an anchor that opens in a new tab', () => {
      // The drawer sits on top of the page the user came from; navigating in place
      // would lose the run they were reading.
      render(
        <RunHistoryDrawer
          open
          agent={agent}
          agentLinkProps={agentLinkProps}
          onClose={jest.fn()}
          onOpenLogs={jest.fn()}
          onRun={mockOnRun}
        />
      );

      const link = screen.getByTestId('agent-link-button');

      expect(link).toHaveAttribute('href', agentLinkProps.href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveTextContent(agentLinkProps.label);
    });
  });

  describe('steps section', () => {
    // The suite-level mock uses mockImplementation; a per-test mockReturnValue would outlive the
    // test and leak into the next one, so restore the default after each.
    afterEach(() => {
      (useAgentRuns as jest.Mock).mockImplementation(() => ({
        runs: mockRuns,
        isLoading: false,
      }));
    });

    it('should show an empty placeholder when the selected run has no steps', () => {
      // Every fixture run ships `steps: []`, so this is the default state.
      renderDrawer();

      expect(screen.getByTestId('run-steps-empty')).toBeInTheDocument();
      expect(
        screen.getByText('message.no-steps-available')
      ).toBeInTheDocument();
      expect(screen.queryByText('RunStepRow')).not.toBeInTheDocument();
    });

    it('should render step rows instead of the placeholder when steps exist', () => {
      (useAgentRuns as jest.Mock).mockReturnValue({
        runs: [
          {
            ...mockRuns[0],
            steps: [
              {
                name: 'Pod Diagnostics',
                status: 'success',
                records: 1,
                filtered: 0,
                updated: 0,
                warnings: 0,
                errors: 0,
              },
            ],
          },
        ],
        isLoading: false,
      });

      renderDrawer();

      expect(screen.getByText('RunStepRow')).toBeInTheDocument();
      expect(screen.queryByTestId('run-steps-empty')).not.toBeInTheDocument();
    });

    it('should drop the header rule when there are no steps to separate', () => {
      renderDrawer();

      const header = screen.getByText('label.steps').parentElement;

      expect(header?.className).not.toContain('tw:border-b');
    });
  });

  describe('run history rail', () => {
    const getCards = () => screen.getAllByTestId('run-history-item');

    it('should keep the rail free of horizontal padding so the cards stay aligned', () => {
      // The cards share the drawer's left edge with the heading, the stat tiles and the Steps card.
      // Any inline padding — or a negative margin compensating for one — breaks that alignment.
      renderDrawer();

      const rail = getCards()[0].parentElement;
      const railClass = rail?.className ?? '';

      ['tw:p-1', 'tw:px-', 'tw:pl-', 'tw:-mx-', 'tw:-ml-'].forEach((cls) =>
        expect(railClass).not.toContain(cls)
      );
    });

    it('should render the cards oldest-first and select the rightmost one', () => {
      renderDrawer();

      const cards = getCards();

      expect(cards.map((card) => card.textContent)).toEqual([
        expect.stringContaining('May 25, 2026'),
        expect.stringContaining('May 26, 2026'),
        expect.stringContaining('May 27, 2026'),
      ]);
      expect(cards.at(-1)?.className).toContain('tw:border-utility-brand-600');
      expect(cards[0].className).toContain('tw:border-secondary');
    });

    it('should mark selection with a border of the same width as unselected cards', () => {
      // A selected card must not change size, and its edge must stay inside the card's own box: the
      // rail is a scroll container, so an outward glow would be clipped.
      renderDrawer();

      const cards = getCards();
      // The newest run is selected by default and is the last card, not the first.
      const selected = cards.at(-1) as HTMLElement;
      const unselected = cards[0];
      // Asserted as "both carry the same valid width utility" rather than a literal width: a
      // hardcoded `tw:border-2` has to be edited whenever the design changes, and the edit that
      // narrowed it once shipped `tw:border-` — no width at all, since Tailwind has no such class.
      const borderWidthClass = (element: HTMLElement) =>
        element.className
          .split(' ')
          .find((entry) => /^tw:border(-\d+)?$/.test(entry));

      expect(borderWidthClass(selected)).toBeDefined();
      expect(borderWidthClass(unselected)).toBe(borderWidthClass(selected));

      expect(selected.className).toContain('tw:border-utility-brand-600');
      expect(selected.className).not.toContain('tw:outline-4');
      expect(unselected.className).toContain('tw:border-secondary');
    });
  });
});
