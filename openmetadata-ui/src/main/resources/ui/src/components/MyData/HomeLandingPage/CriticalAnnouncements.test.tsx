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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AnnouncementType } from '../../../generated/entity/feed/announcement';
import {
  AnnouncementEntity,
  listAnnouncements,
} from '../../../rest/announcementsAPI';
import { useRouteActivation } from '../../platform/ai-shell/context/useRouteActivation';
import CriticalAnnouncements from './CriticalAnnouncements';
import { CRITICAL_ANNOUNCEMENTS_FETCH_LIMIT } from './CriticalAnnouncements.constants';
import {
  DismissedAnnouncementsScope,
  getDismissedAnnouncementsStorageKey,
} from './useDismissedAnnouncements';

const USER_ID = 'user-1';

let mockCurrentUser: { id: string } | undefined = { id: USER_ID };

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: mockCurrentUser }),
}));

jest.mock('../../../rest/announcementsAPI', () => ({
  listAnnouncements: jest.fn(),
}));

jest.mock('../../platform/ai-shell/context/useRouteActivation', () => ({
  useRouteActivation: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { current?: number; total?: number }) =>
      options?.total === undefined
        ? key
        : `${options.current} of ${options.total}`,
  }),
}));

const mockListAnnouncements = listAnnouncements as jest.MockedFunction<
  typeof listAnnouncements
>;

const mockUseRouteActivation = useRouteActivation as jest.MockedFunction<
  typeof useRouteActivation
>;

const DAY_MS = 24 * 60 * 60 * 1000;

const makeCritical = (
  id: string,
  startOffsetDays: number,
  overrides: Partial<AnnouncementEntity> = {}
): AnnouncementEntity =>
  ({
    id,
    name: `announcement-${id}`,
    displayName: `Title ${id}`,
    description: `**Body** of ${id}`,
    type: AnnouncementType.Critical,
    startTime: Date.now() - startOffsetDays * DAY_MS,
    endTime: Date.now() + DAY_MS,
    ...overrides,
  } as AnnouncementEntity);

const respondWith = (announcements: AnnouncementEntity[]) =>
  mockListAnnouncements.mockResolvedValue({
    data: announcements,
    paging: { total: announcements.length },
  });

const renderBanner = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <CriticalAnnouncements />
    </QueryClientProvider>
  );
};

const storageKey = getDismissedAnnouncementsStorageKey(
  USER_ID,
  DismissedAnnouncementsScope.CriticalBanner
);

describe('CriticalAnnouncements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockCurrentUser = { id: USER_ID };
  });

  it('asks only for live critical system announcements', async () => {
    respondWith([]);

    renderBanner();

    await waitFor(() => {
      expect(mockListAnnouncements).toHaveBeenCalledWith({
        active: true,
        limit: CRITICAL_ANNOUNCEMENTS_FETCH_LIMIT,
        system: true,
        type: AnnouncementType.Critical,
      });
    });
  });

  it('renders nothing when no critical announcement is live', async () => {
    respondWith([]);

    renderBanner();

    await waitFor(() => expect(mockListAnnouncements).toHaveBeenCalled());

    expect(
      screen.queryByTestId('critical-announcements')
    ).not.toBeInTheDocument();
  });

  it('shows a single announcement without a carousel', async () => {
    respondWith([makeCritical('a', 1)]);

    renderBanner();

    expect(
      await screen.findByTestId('critical-announcement-title')
    ).toHaveTextContent('Title a');
    expect(
      screen.getByTestId('critical-announcement-description')
    ).toHaveTextContent('Body of a');
    expect(screen.getByText('label.critical')).toBeInTheDocument();
    expect(
      screen.queryByTestId('critical-announcement-position')
    ).not.toBeInTheDocument();
  });

  it('leaves the description out when the announcement has none', async () => {
    respondWith([makeCritical('bare', 1, { description: '' })]);

    renderBanner();

    expect(
      await screen.findByTestId('critical-announcement-title')
    ).toHaveTextContent('Title bare');
    expect(
      screen.queryByTestId('critical-announcement-description')
    ).not.toBeInTheDocument();
  });

  it('pages through several, newest first, wrapping at either end', async () => {
    respondWith([makeCritical('older', 3), makeCritical('newest', 1)]);

    renderBanner();

    expect(
      await screen.findByTestId('critical-announcement-title')
    ).toHaveTextContent('Title newest');
    expect(
      screen.getByTestId('critical-announcement-position')
    ).toHaveTextContent('1 of 2');

    fireEvent.click(screen.getByTestId('critical-announcement-next'));

    expect(screen.getByTestId('critical-announcement-title')).toHaveTextContent(
      'Title older'
    );
    expect(
      screen.getByTestId('critical-announcement-position')
    ).toHaveTextContent('2 of 2');

    fireEvent.click(screen.getByTestId('critical-announcement-next'));

    expect(screen.getByTestId('critical-announcement-title')).toHaveTextContent(
      'Title newest'
    );

    fireEvent.click(screen.getByTestId('critical-announcement-previous'));

    expect(screen.getByTestId('critical-announcement-title')).toHaveTextContent(
      'Title older'
    );
  });

  it('dismissing shows the next one and remembers the dismissal per user', async () => {
    respondWith([makeCritical('first', 1), makeCritical('second', 2)]);

    const { unmount } = renderBanner();

    await screen.findByText('Title first');
    fireEvent.click(screen.getByTestId('critical-announcement-dismiss'));

    expect(screen.getByTestId('critical-announcement-title')).toHaveTextContent(
      'Title second'
    );
    expect(
      screen.queryByTestId('critical-announcement-position')
    ).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(storageKey) ?? '[]')).toEqual([
      'first',
    ]);

    unmount();
    renderBanner();

    expect(
      await screen.findByTestId('critical-announcement-title')
    ).toHaveTextContent('Title second');
    expect(screen.queryByText('Title first')).not.toBeInTheDocument();
  });

  it('steps back to the neighbour when the last one in the carousel is dismissed', async () => {
    respondWith([makeCritical('first', 1), makeCritical('last', 2)]);

    renderBanner();

    await screen.findByText('Title first');
    fireEvent.click(screen.getByTestId('critical-announcement-next'));
    fireEvent.click(screen.getByTestId('critical-announcement-dismiss'));

    expect(screen.getByTestId('critical-announcement-title')).toHaveTextContent(
      'Title first'
    );
  });

  it('disappears once every live announcement is dismissed', async () => {
    respondWith([makeCritical('only', 1)]);

    renderBanner();

    await screen.findByText('Title only');
    fireEvent.click(screen.getByTestId('critical-announcement-dismiss'));

    expect(
      screen.queryByTestId('critical-announcements')
    ).not.toBeInTheDocument();
  });

  it('refetches when the Home page is revisited with a dirty cache', async () => {
    respondWith([makeCritical('a', 1)]);

    renderBanner();

    await screen.findByText('Title a');
    const onActivate = mockUseRouteActivation.mock.calls.at(-1)?.[0];
    respondWith([makeCritical('a', 1), makeCritical('b', 2)]);

    onActivate?.('dirty');

    expect(
      await screen.findByTestId('critical-announcement-position')
    ).toHaveTextContent('1 of 2');
  });

  it('only warms the cache on a plain revisit', async () => {
    respondWith([makeCritical('a', 1)]);

    renderBanner();

    await screen.findByText('Title a');
    const callsBefore = mockListAnnouncements.mock.calls.length;
    const onActivate = mockUseRouteActivation.mock.calls.at(-1)?.[0];

    onActivate?.('activation');

    // Still fresh within the TTL, so the prefetch is a no-op.
    expect(mockListAnnouncements).toHaveBeenCalledTimes(callsBefore);
  });

  it('keeps its dismissals apart from the rail and drops ids no longer live', async () => {
    localStorage.setItem(storageKey, JSON.stringify(['gone', 'live']));
    localStorage.setItem(
      getDismissedAnnouncementsStorageKey(USER_ID),
      JSON.stringify(['rail-card'])
    );
    respondWith([makeCritical('live', 1), makeCritical('shown', 2)]);

    renderBanner();

    expect(
      await screen.findByTestId('critical-announcement-title')
    ).toHaveTextContent('Title shown');

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(storageKey) ?? '[]')).toEqual([
        'live',
      ]);
    });

    expect(
      JSON.parse(
        localStorage.getItem(getDismissedAnnouncementsStorageKey(USER_ID)) ??
          '[]'
      )
    ).toEqual(['rail-card']);
  });
});
