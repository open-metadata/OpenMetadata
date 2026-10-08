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
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import {
  ActivityEvent,
  ActivityEventType,
} from '../../../../generated/entity/activity/activityEvent';
import { queryClient } from '../../../../queryClient';
import { getMyActivityFeed } from '../../../../rest/activityAPI';
import TeamActivityWidget, {
  TEAM_ACTIVITY_COUNT_CAP,
  TEAM_ACTIVITY_WINDOW_DAYS,
} from './TeamActivityWidget';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../Common/TopicWidget/TopicCard', () => ({
  __esModule: true,
  default: ({
    children,
    isError,
    meta,
    status,
    summary,
  }: {
    children?: React.ReactNode;
    isError?: boolean;
    meta?: React.ReactNode;
    status?: { label: string };
    summary: React.ReactNode;
  }) => (
    <section>
      <div data-testid="summary">{summary}</div>
      {status && <span data-testid="status">{status.label}</span>}
      {meta && <span data-testid="meta">{meta}</span>}
      {isError && <span data-testid="card-error" />}
      {children}
    </section>
  ),
}));

jest.mock('../Common/TopicWidget/activityVerb', () => ({
  ActivitySentence: ({ event }: { event: { id: string } }) => (
    <span data-testid={`sentence-${event.id}`} />
  ),
}));

jest.mock('../../../../rest/activityAPI', () => ({
  getMyActivityFeed: jest.fn(),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => undefined),
}));

jest.mock('../../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: { getEntityLink: () => '/entity' },
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  getRelativeTime: () => '1h',
}));

const mockFeed = getMyActivityFeed as jest.MockedFunction<
  typeof getMyActivityFeed
>;

const events = (count: number): ActivityEvent[] =>
  Array.from(
    { length: count },
    (_, i) =>
      ({
        actor: { id: 'u', name: 'ada', type: 'user' },
        entity: { fullyQualifiedName: `t${i}`, id: `t${i}`, type: 'table' },
        eventType: ActivityEventType.DescriptionUpdated,
        id: `evt-${i}`,
        timestamp: i,
      } as ActivityEvent)
  );

const renderWidget = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <TeamActivityWidget widgetKey="KnowledgePanel.TeamActivity-1" />
    </QueryClientProvider>
  );

describe('TeamActivityWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('reads one event past the cap so it can tell "20" from "more than 20"', async () => {
    mockFeed.mockResolvedValue({ data: events(3) } as never);
    renderWidget();

    await waitFor(() => expect(mockFeed).toHaveBeenCalled());

    expect(mockFeed).toHaveBeenCalledWith({
      days: TEAM_ACTIVITY_WINDOW_DAYS,
      limit: TEAM_ACTIVITY_COUNT_CAP + 1,
    });
  });

  it('shows the exact count when the feed fits under the cap', async () => {
    mockFeed.mockResolvedValue({ data: events(3) } as never);
    renderWidget();

    expect(await screen.findByTestId('status')).toHaveTextContent(
      'message.count-updates {"count":3}'
    );
  });

  it('says "20+" rather than passing the cap off as the total', async () => {
    mockFeed.mockResolvedValue({
      data: events(TEAM_ACTIVITY_COUNT_CAP + 1),
    } as never);
    renderWidget();

    expect(await screen.findByTestId('status')).toHaveTextContent(
      `message.count-plus-updates {"count":${TEAM_ACTIVITY_COUNT_CAP}}`
    );
  });

  // my-feed is "entities owned by the user or their teams", not domains.
  it('describes the feed scope as assets owned by the viewer or their teams', async () => {
    mockFeed.mockResolvedValue({ data: events(2) } as never);
    renderWidget();

    expect(await screen.findByTestId('meta')).toHaveTextContent(
      `message.activity-on-assets-owned-by-you-or-your-teams {"count":${TEAM_ACTIVITY_WINDOW_DAYS}}`
    );
    expect(screen.queryByText(/domains-you-own/)).toBeNull();
  });

  it('renders each row as a whole sentence, capped at six rows', async () => {
    mockFeed.mockResolvedValue({ data: events(8) } as never);
    renderWidget();

    const rows = await screen.findByTestId('team-activity-rows');

    expect(rows.querySelectorAll('li')).toHaveLength(6);
    expect(screen.getByTestId('team-activity-evt-0')).toContainElement(
      screen.getAllByTestId('sentence-evt-0')[1]
    );
  });

  it('shows the empty state when nothing happened', async () => {
    mockFeed.mockResolvedValue({ data: [] } as never);
    renderWidget();

    expect(await screen.findByTestId('team-activity-empty')).toHaveTextContent(
      'message.no-recent-activity-on-owned-assets'
    );
    expect(screen.queryByTestId('status')).toBeNull();
  });

  it('hands the card its error rather than an empty state', async () => {
    mockFeed.mockRejectedValue(new Error('network'));
    renderWidget();

    expect(await screen.findByTestId('card-error')).toBeInTheDocument();
    expect(screen.queryByTestId('team-activity-empty')).toBeNull();
  });
});
