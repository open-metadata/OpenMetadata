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
import { CRITICAL_ANNOUNCEMENTS_PAGE_SIZE } from './CriticalAnnouncements.constants';
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
  useTranslation: () => ({ t: (key: string) => key }),
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

const renderBanner = (fallback?: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <CriticalAnnouncements fallback={fallback} />
    </QueryClientProvider>
  );
};

const RAIL_TESTID = 'critical-announcement-rail';
const NEXT_BTN = 'critical-announcement-next';
const PREV_BTN = 'critical-announcement-previous';

const titles = () =>
  screen
    .getAllByTestId('critical-announcement-title')
    .map((title) => title.textContent);

/**
 * jsdom reports every layout box as 0, so the rail would always look
 * unscrollable. Give it a real geometry and a spy-able `scrollBy`.
 */
const stubRailGeometry = ({
  clientWidth = 400,
  scrollWidth = 800,
  scrollLeft = 0,
}: {
  clientWidth?: number;
  scrollWidth?: number;
  scrollLeft?: number;
} = {}) => {
  const rail = screen.getByTestId(RAIL_TESTID);
  Object.defineProperty(rail, 'clientWidth', {
    configurable: true,
    value: clientWidth,
  });
  Object.defineProperty(rail, 'scrollWidth', {
    configurable: true,
    value: scrollWidth,
  });
  Object.defineProperty(rail, 'scrollLeft', {
    configurable: true,
    value: scrollLeft,
    writable: true,
  });
  rail.scrollBy = jest.fn();
  // Re-run the scroll-state sync now that the box has a size.
  fireEvent.scroll(rail);

  return rail;
};

const scrollRailTo = (rail: HTMLElement, scrollLeft: number) => {
  Object.defineProperty(rail, 'scrollLeft', {
    configurable: true,
    value: scrollLeft,
    writable: true,
  });
  fireEvent.scroll(rail);
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
        after: undefined,
        limit: CRITICAL_ANNOUNCEMENTS_PAGE_SIZE,
        system: true,
        type: AnnouncementType.Critical,
      });
    });
  });

  it('reads every page, so the newest is shown even when it is not on the first', async () => {
    mockListAnnouncements
      .mockResolvedValueOnce({
        data: [makeCritical('older', 3)],
        paging: { after: 'cursor-2', total: 2 },
      })
      .mockResolvedValueOnce({
        data: [makeCritical('newest', 1)],
        paging: { total: 2 },
      });

    renderBanner();

    await screen.findByText('Title newest');

    expect(titles()).toEqual(['Title newest', 'Title older']);
    expect(mockListAnnouncements).toHaveBeenCalledTimes(2);
    expect(mockListAnnouncements).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: 'cursor-2' })
    );
  });

  it('shows its fallback in the slot while no critical announcement is live', async () => {
    respondWith([]);

    renderBanner(<div data-testid="greeting" />);

    expect(await screen.findByTestId('greeting')).toBeInTheDocument();
  });

  it('takes the slot from its fallback while one is live', async () => {
    respondWith([makeCritical('c1', 1)]);

    renderBanner(<div data-testid="greeting" />);

    expect(
      await screen.findByTestId('critical-announcements')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('greeting')).not.toBeInTheDocument();
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
    expect(screen.queryByTestId(NEXT_BTN)).not.toBeInTheDocument();
    expect(screen.queryByTestId(PREV_BTN)).not.toBeInTheDocument();
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

  it('lists several newest first, with no heading over them', async () => {
    respondWith([makeCritical('older', 3), makeCritical('newest', 1)]);

    renderBanner();

    await screen.findByText('Title newest');

    expect(titles()).toEqual(['Title newest', 'Title older']);
    expect(
      screen.queryByText('label.critical-announcement-plural')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId(NEXT_BTN)).toBeInTheDocument();
  });

  it('slides the rail a page at a time on next and previous', async () => {
    respondWith([makeCritical('first', 1), makeCritical('second', 2)]);

    renderBanner();

    await screen.findByText('Title first');
    const rail = stubRailGeometry({ clientWidth: 400 });

    fireEvent.click(screen.getByTestId(NEXT_BTN));

    expect(rail.scrollBy).toHaveBeenCalledWith({
      behavior: 'smooth',
      left: 360,
    });

    // `scrollBy` is a spy, so move the rail by hand before paging back.
    scrollRailTo(rail, 400);
    fireEvent.click(screen.getByTestId(PREV_BTN));

    expect(rail.scrollBy).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      left: -360,
    });
  });

  it('disables previous at the first banner and next at the last', async () => {
    respondWith([makeCritical('first', 1), makeCritical('second', 2)]);

    renderBanner();

    await screen.findByText('Title first');
    const rail = stubRailGeometry({ clientWidth: 400, scrollWidth: 800 });

    expect(screen.getByTestId(PREV_BTN)).toBeDisabled();
    expect(screen.getByTestId(NEXT_BTN)).not.toBeDisabled();

    scrollRailTo(rail, 400);

    expect(screen.getByTestId(PREV_BTN)).not.toBeDisabled();
    expect(screen.getByTestId(NEXT_BTN)).toBeDisabled();
  });

  it('dismissing shows the next one and remembers the dismissal per user', async () => {
    respondWith([makeCritical('first', 1), makeCritical('second', 2)]);

    const { unmount } = renderBanner();

    await screen.findByText('Title first');
    fireEvent.click(screen.getAllByTestId('critical-announcement-dismiss')[0]);

    expect(titles()).toEqual(['Title second']);
    expect(screen.queryByTestId(NEXT_BTN)).not.toBeInTheDocument();
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

    await waitFor(() => expect(titles()).toEqual(['Title a', 'Title b']));
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
