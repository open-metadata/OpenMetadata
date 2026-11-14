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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  ApprovalBasis,
  EntityStatus,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import { EventType } from '../../../../generated/type/ontologyReleaseEvent';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { getOntologyReleaseEvents } from '../../../../rest/ontologyAPI';
import OntologyReleaseHistory from './OntologyReleaseHistory';

jest.mock('../../../../hooks/useAppMode', () => ({
  useIsAiMode: jest.fn().mockReturnValue(false),
}));
jest.mock('./OntologyReleaseExport', () => () => null);
jest.mock('./OntologyReleaseCompare', () => () => null);
jest.mock('../../../../rest/ontologyAPI', () => ({
  getOntologyReleaseEvents: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

const release = (
  id: string,
  semanticVersion: string,
  entityStatus: EntityStatus,
  extra: Partial<OntologyRelease> = {}
) =>
  ({
    id,
    semanticVersion,
    entityStatus,
    releaseRevision: 1,
    sealedAt: 1,
    sealedBy: 'admin',
    ...extra,
  } as OntologyRelease);

const history = (releases: OntologyRelease[]) =>
  ({
    isPending: false,
    isError: false,
    isSuccess: true,
    hasNextPage: false,
    data: { pages: [{ data: releases, paging: { total: releases.length } }] },
  } as never);

const renderHistory = (
  releases: OntologyRelease[],
  props: { latestReleaseId?: string; onSelect?: jest.Mock } = {}
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <OntologyReleaseHistory
        history={history(releases)}
        latestReleaseId={props.latestReleaseId}
        onSelect={props.onSelect ?? jest.fn()}
      />
    </QueryClientProvider>
  );

const event = (eventType: EventType, extra: object = {}) => ({
  id: eventType,
  eventType,
  createdBy: 'system',
  createdAt: 1,
  ...extra,
});

const mockEvents = (events: ReturnType<typeof event>[]) =>
  (getOntologyReleaseEvents as jest.Mock).mockResolvedValue({
    data: events,
    paging: { total: events.length },
  });

const summary = { added: 3, changed: 1, removed: 2, deprecated: 1 };

describe('Releases tab', () => {
  beforeEach(() => {
    (getOntologyReleaseEvents as jest.Mock).mockReset();
    mockEvents([]);
  });

  it('lists only the latest draft when older drafts have no review task', () => {
    renderHistory(
      [
        release('d3', '1.0.0', EntityStatus.Draft),
        release('d2', '0.1.0', EntityStatus.Draft),
        release('d1', '0.0.1', EntityStatus.Draft),
      ],
      { latestReleaseId: 'd3' }
    );

    expect(screen.getByTestId('ontology-release-select-d3')).toHaveTextContent(
      '1.0.0'
    );
    expect(screen.queryByTestId('ontology-release-select-d2')).toBeNull();
    expect(screen.queryByTestId('ontology-release-select-d1')).toBeNull();
  });

  it('keeps an older draft that has a review task', () => {
    renderHistory(
      [
        release('d2', '1.0.0', EntityStatus.Draft),
        release('d1', '0.1.0', EntityStatus.InReview, { reviewTask: 'task' }),
      ],
      { latestReleaseId: 'd2' }
    );

    expect(screen.getByTestId('ontology-release-select-d2')).toBeVisible();
    expect(screen.getByTestId('ontology-release-select-d1')).toBeVisible();
  });

  it('reads Published without review on a direct publish row', () => {
    renderHistory([
      release('direct', '1.0.0', EntityStatus.Approved, {
        approvalBasis: ApprovalBasis.NoReviewersConfigured,
        changeSummary: summary,
      }),
    ]);

    expect(
      screen.getByTestId('ontology-release-decision-direct')
    ).toHaveTextContent('label.published-without-review');
    expect(getOntologyReleaseEvents).not.toHaveBeenCalled();
  });

  it('shows the approver and the per-type counts on an approved row', async () => {
    mockEvents([
      event(EventType.Captured),
      event(EventType.Approved, { voters: ['qa.reviewer1'] }),
    ]);
    renderHistory([
      release('approved', '1.1.0', EntityStatus.Approved, {
        approvalBasis: ApprovalBasis.Reviewed,
        changeSummary: summary,
      }),
    ]);

    expect(
      await screen.findByTestId('ontology-release-decision-approved')
    ).toHaveTextContent(
      'message.ontology-release-approved-by {"reviewers":"qa.reviewer1"}'
    );
    expect(
      screen.getByTestId('ontology-release-count-approved')
    ).toHaveTextContent(
      '3 label.added-lowercase · 2 label.changed-lowercase · 2 label.removed-lowercase'
    );
  });

  it('names the reviewer on a rejected row', async () => {
    mockEvents([event(EventType.Rejected, { createdBy: 'qa.reviewer2' })]);
    renderHistory([
      release('rejected', '1.2.0', EntityStatus.Rejected, {
        changeSummary: summary,
      }),
    ]);

    expect(
      await screen.findByTestId('ontology-release-decision-rejected')
    ).toHaveTextContent(
      'message.ontology-release-rejected-by {"reviewers":"qa.reviewer2"}'
    );
  });

  it('shows a draft row with no decision and the count fallback for legacy summaries', () => {
    renderHistory(
      [release('draft', '1.3.0', EntityStatus.Draft, { releaseNotes: 'wip' })],
      { latestReleaseId: 'draft' }
    );

    expect(screen.getByTestId('ontology-release-select-draft')).toBeVisible();
    expect(screen.queryByTestId('ontology-release-decision-draft')).toBeNull();
    expect(
      screen.getByTestId('ontology-release-count-draft')
    ).toHaveTextContent('message.ontology-change-summary-unavailable');
    expect(screen.getByText('wip')).toBeVisible();
  });

  it('lists the per-kind counts, folds rules together and leaves the ontology row out', () => {
    renderHistory([
      release('kinds', '2.0.0', EntityStatus.Approved, {
        approvalBasis: ApprovalBasis.NoReviewersConfigured,
        changeSummary: {
          ...summary,
          kindCounts: {
            ontology: 1,
            concept: 2,
            property: 1,
            association: 0,
            axiom: 1,
            shape: 2,
          },
        },
      }),
    ]);

    expect(screen.getByTestId('ontology-release-kinds-kinds').textContent).toBe(
      'message.native-concept-count {"count":2} · message.ontology-property-count {"count":1} · message.ontology-rule-count {"count":3}'
    );
  });

  it('shows no kind line for a release captured before kind counts existed', () => {
    renderHistory([
      release('older', '1.0.0', EntityStatus.Approved, {
        approvalBasis: ApprovalBasis.NoReviewersConfigured,
        changeSummary: summary,
      }),
    ]);

    expect(
      screen.getByTestId('ontology-release-count-older')
    ).toHaveTextContent(
      '3 label.added-lowercase · 2 label.changed-lowercase · 2 label.removed-lowercase'
    );
    expect(screen.queryByTestId('ontology-release-kinds-older')).toBeNull();
  });

  it('shows the same row facts in AI mode', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    mockEvents([event(EventType.Approved, { voters: ['qa.reviewer1'] })]);
    renderHistory([
      release('ai', '3.0.0', EntityStatus.Approved, {
        approvalBasis: ApprovalBasis.Reviewed,
        changeSummary: summary,
        sealedBy: 'author.one',
      }),
    ]);

    await waitFor(() =>
      expect(
        screen.getByTestId('ontology-release-decision-ai')
      ).toHaveTextContent('qa.reviewer1label.approved')
    );

    expect(screen.getByTestId('ontology-release-status-ai')).toHaveTextContent(
      'label.approved'
    );
    expect(screen.getByTestId('ontology-release-count-ai').textContent).toBe(
      '+3 ~2 −2'
    );
    expect(screen.getByText('author.one')).toBeVisible();
    expect(screen.getByTestId('ontology-release-menu-ai')).toBeVisible();
    expect(
      screen.getByTestId('ontology-release-filter-published')
    ).toHaveTextContent('label.published1');
    expect(
      screen.getByTestId('ontology-release-filter-draft')
    ).toHaveTextContent('label.drafts0');

    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });

  it('opens an AI release from its version button, with the row menu as its own control', () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    const onSelect = jest.fn();
    renderHistory([release('ai', '3.0.0', EntityStatus.Approved)], {
      onSelect,
    });

    const open = screen.getByTestId('ontology-release-select-ai');

    expect(open.tagName).toBe('BUTTON');
    expect(open).toHaveTextContent('v3.0.0');
    expect(open).not.toContainElement(
      screen.getByTestId('ontology-release-menu-ai')
    );

    fireEvent.click(open);

    expect(onSelect).toHaveBeenCalledWith('ai');

    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });

  it('opens Compare versions from the AI toolbar and returns to all releases', () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <OntologyReleaseHistory
          history={history([release('one', '1.0.0', EntityStatus.Approved)])}
          ontologyId="ontology"
          onSelect={jest.fn()}
        />
      </QueryClientProvider>
    );

    expect(
      screen.queryByTestId('ontology-release-compare-back')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-release-compare-open'));

    expect(screen.getByTestId('ontology-release-compare-back')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-release-row')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-release-compare-back'));

    expect(screen.getAllByTestId('ontology-release-row')).toHaveLength(1);

    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });

  it('says no releases yet in AI mode before the first release', () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    renderHistory([]);

    expect(
      screen.getByTestId('ontology-release-history-empty')
    ).toHaveTextContent('message.ontology-no-releases-yet');

    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });

  it('marks the active release on its row', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <OntologyReleaseHistory
          activeReleaseId="live"
          history={history([
            release('live', '2.0.0', EntityStatus.Approved, {
              approvalBasis: ApprovalBasis.NoReviewersConfigured,
            }),
          ])}
          onSelect={jest.fn()}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('label.active')).toBeVisible();
  });

  describe('search and filter', () => {
    const releases = [
      release('a', '1.0.0', EntityStatus.Approved, {
        approvalBasis: ApprovalBasis.NoReviewersConfigured,
        releaseNotes: 'launch of billing',
      }),
      release('b', '1.1.0', EntityStatus.Rejected),
      release('c', '2.0.0', EntityStatus.Draft, { releaseNotes: 'rewrite' }),
    ];
    const visibleIds = () =>
      screen
        .getAllByTestId('ontology-release-row')
        .map((row) => within(row).getByRole('button', { expanded: false }))
        .map((button) => button.textContent);

    it('narrows rows by version and by note text', () => {
      renderHistory(releases, { latestReleaseId: 'c' });
      const search = screen.getByTestId('ontology-release-search');

      fireEvent.change(search, { target: { value: '1.1' } });

      expect(visibleIds()).toEqual(['1.1.0']);

      fireEvent.change(search, { target: { value: 'BILLING' } });

      expect(visibleIds()).toEqual(['1.0.0']);

      fireEvent.change(search, { target: { value: 'nothing matches' } });

      expect(screen.queryAllByTestId('ontology-release-row')).toHaveLength(0);
      expect(screen.getByText('message.no-data-available')).toBeVisible();
    });

    it('filters rows by status', () => {
      renderHistory(releases, { latestReleaseId: 'c' });

      fireEvent.click(screen.getByTestId('ontology-release-filter-published'));

      expect(visibleIds()).toEqual(['1.0.0']);

      fireEvent.click(screen.getByTestId('ontology-release-filter-rejected'));

      expect(visibleIds()).toEqual(['1.1.0']);

      fireEvent.click(screen.getByTestId('ontology-release-filter-draft'));

      expect(visibleIds()).toEqual(['2.0.0']);

      fireEvent.click(screen.getByTestId('ontology-release-filter-all'));

      expect(visibleIds()).toEqual(['1.0.0', '1.1.0', '2.0.0']);
    });
  });

  it('pages ten rows at a time and keeps the selected release across pages', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      release(`r${index}`, `1.${index}.0`, EntityStatus.Approved, {
        approvalBasis: ApprovalBasis.NoReviewersConfigured,
      })
    );
    const onSelect = jest.fn();
    const { rerender } = renderHistory(many, { onSelect });

    expect(screen.getAllByTestId('ontology-release-row')).toHaveLength(10);
    expect(screen.getByTestId('ontology-release-page')).toHaveTextContent(
      'label.page 1 / 2'
    );

    fireEvent.click(screen.getByTestId('ontology-release-select-r3'));

    expect(onSelect).toHaveBeenCalledWith('r3');

    fireEvent.click(screen.getByTestId('ontology-release-next'));

    expect(screen.getAllByTestId('ontology-release-row')).toHaveLength(2);
    expect(screen.getByTestId('ontology-release-next')).toBeDisabled();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <OntologyReleaseHistory
          history={history(many)}
          selectedReleaseId="r3"
          onSelect={onSelect}
        />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('ontology-release-page')).toHaveTextContent(
      'label.page 2 / 2'
    );
  });
});
