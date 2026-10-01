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

import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AnnouncementType } from '../../../generated/entity/feed/announcement';
import {
  AnnouncementEntity,
  getActiveAnnouncements,
  listAnnouncements,
} from '../../../rest/announcementsAPI';
import React from 'react';
import { queryClient } from '../../../queryClient';
import AnnouncementsRail from './AnnouncementsRail';

jest.mock('react-router-dom', () => ({
  Link: ({
    children,
    to,
    ...rest
  }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('../../../rest/announcementsAPI', () => ({
  getActiveAnnouncements: jest.fn(),
  listAnnouncements: jest.fn(),
}));

jest.mock('../../../utils/FeedUtilsPure', () => ({
  getEntityFQN: jest.fn(() => 'service.table'),
  getEntityType: jest.fn(() => 'table'),
  prepareFeedLink: jest.fn(() => '/table/service.table'),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  getRelativeTime: jest.fn(() => '1 day ago'),
}));

jest.mock('../../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

jest.mock('../../../utils/TableUtils', () => ({
  getEntityIcon: jest.fn(() => <svg data-testid="entity-icon" />),
}));

jest.mock('../../../components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: () => <span data-testid="profile-picture" />,
}));

interface MockTestIdProps {
  'data-testid'?: string;
}

jest.mock('@openmetadata/ui-core-components', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  );

  const Dialog = ({
    children,
    onClose,
  }: {
    children?: React.ReactNode;
    onClose?: () => void;
  }) => (
    <div data-testid="dialog">
      <button data-testid="dialog-close" onClick={onClose}>
        close
      </button>
      {children}
    </div>
  );
  Dialog.Header = Passthrough;
  Dialog.Content = Passthrough;
  Dialog.Footer = Passthrough;

  const WithTestId = ({
    children,
    'data-testid': dataTestId,
  }: MockTestIdProps & { children?: React.ReactNode }) => (
    <span data-testid={dataTestId}>{children}</span>
  );

  return {
    Badge: WithTestId,
    Button: ({
      children,
      onPress,
      'data-testid': dataTestId,
    }: MockTestIdProps & {
      children?: React.ReactNode;
      onPress?: () => void;
    }) => (
      <button data-testid={dataTestId} onClick={onPress}>
        {children}
      </button>
    ),
    ButtonUtility: ({
      tooltip,
      onClick,
      isDisabled,
      'data-testid': dataTestId,
    }: MockTestIdProps & {
      tooltip?: string;
      onClick?: (e: React.MouseEvent) => void;
      isDisabled?: boolean;
    }) => (
      <button
        aria-label={tooltip}
        data-testid={dataTestId}
        disabled={isDisabled}
        onClick={onClick}>
        {tooltip}
      </button>
    ),
    Dialog,
    Dot: () => <span data-testid="dot" />,
    Modal: Passthrough,
    ModalOverlay: ({
      children,
      isOpen,
    }: {
      children?: React.ReactNode;
      isOpen?: boolean;
    }) => (isOpen ? <div>{children}</div> : null),
    Tooltip: ({
      children,
      title,
    }: {
      children?: React.ReactNode;
      title?: string;
    }) => <span title={title}>{children}</span>,
    Typography: WithTestId,
  };
});

jest.mock('../../../../assets/svg/ic-announcement.svg', () => ({
  ReactComponent: () => <svg data-testid="announcement-icon" />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockGetActiveAnnouncements =
  getActiveAnnouncements as jest.MockedFunction<typeof getActiveAnnouncements>;
const mockListAnnouncements = listAnnouncements as jest.MockedFunction<
  typeof listAnnouncements
>;

const ANNOUNCEMENT_ID = 'announcement-1';
const CARD_TESTID = `announcement-card-${ANNOUNCEMENT_ID}`;
const RAIL_TESTID = 'announcement-rail';
const NEXT_BTN = 'announcement-next';
const PREV_BTN = 'announcement-previous';
const VIEW_ALL_BTN = 'announcement-view-all';
const DISMISS_LABEL = 'label.close';
const TYPE_BADGE = 'announcement-type-badge';

const cardId = (id: string) => `announcement-card-${id}`;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Status is derived from the window, not read off the stored `status` field, so
 * the fixtures carry real windows. The default is a live one — the rail only
 * ever shows announcements the server already considered active.
 */
const LIVE_WINDOW = {
  startTime: Date.now() - DAY_MS,
  endTime: Date.now() + DAY_MS,
};
const EXPIRED_WINDOW = {
  startTime: Date.now() - 2 * DAY_MS,
  endTime: Date.now() - DAY_MS,
};
const SCHEDULED_WINDOW = {
  startTime: Date.now() + DAY_MS,
  endTime: Date.now() + 2 * DAY_MS,
};

const makeAnnouncement = (
  id: string,
  overrides: Partial<AnnouncementEntity> = {}
): AnnouncementEntity =>
  ({
    id,
    entityLink: '<#E::table::service.table>',
    ...LIVE_WINDOW,
    ...overrides,
  } as AnnouncementEntity);

/**
 * jsdom reports every layout box as 0, so the rail would always look
 * unscrollable. Give it a real geometry and a spy-able `scrollBy`.
 */
const stubRailGeometry = ({
  clientWidth = 400,
  scrollWidth = 1200,
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
  // Re-run the widget's scroll-state sync now that the box has a size.
  fireEvent.scroll(rail);

  return rail;
};

const renderWithQueryClient = (children: React.ReactNode) =>
  render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('AnnouncementsRail cache integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    window.sessionStorage.clear();
    mockGetActiveAnnouncements.mockResolvedValue({
      data: [makeAnnouncement(ANNOUNCEMENT_ID)],
    } as never);
    mockListAnnouncements.mockResolvedValue({ data: [] } as never);
  });

  it('deduplicates concurrent active-announcement requests', async () => {
    renderWithQueryClient(
      <>
        <AnnouncementsRail />
        <AnnouncementsRail />
      </>
    );

    await waitFor(() => {
      expect(screen.getAllByTestId(CARD_TESTID)).toHaveLength(2);
    });

    expect(mockGetActiveAnnouncements).toHaveBeenCalledTimes(1);
  });

  it('hydrates a remounted widget from cache without another API call', async () => {
    const first = renderWithQueryClient(<AnnouncementsRail />);

    await waitFor(() => {
      expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument();
    });

    first.unmount();
    renderWithQueryClient(<AnnouncementsRail />);

    expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument();
    expect(mockGetActiveAnnouncements).toHaveBeenCalledTimes(1);
  });

  it('links the whole card to the announcement entity route', async () => {
    renderWithQueryClient(<AnnouncementsRail />);

    await waitFor(() => {
      expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument();
    });

    // A real anchor, so the card supports cmd/middle-click like any link.
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/table/service.table'
    );
  });

  it('flattens the description to plain text with the full body on hover', async () => {
    mockGetActiveAnnouncements.mockResolvedValue({
      data: [
        makeAnnouncement(ANNOUNCEMENT_ID, {
          description: '<p>Hi team, big change coming</p>',
        }),
      ],
    } as never);

    renderWithQueryClient(<AnnouncementsRail />);

    await waitFor(() => {
      expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument();
    });

    // The clamped body carries the full plain text as a hover tooltip.
    expect(screen.getByTitle('Hi team, big change coming')).toBeInTheDocument();
  });

  it('renders no description block for an empty rich-text description', async () => {
    mockGetActiveAnnouncements.mockResolvedValue({
      data: [makeAnnouncement(ANNOUNCEMENT_ID, { description: '<p></p>' })],
    } as never);

    renderWithQueryClient(<AnnouncementsRail />);

    await waitFor(() => {
      expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument();
    });

    expect(screen.queryByTitle(/./)).not.toBeInTheDocument();
  });

  it('renders no section at all on fetch failure', async () => {
    mockGetActiveAnnouncements.mockRejectedValue(new Error('network'));

    renderWithQueryClient(<AnnouncementsRail />);

    // On error (incl. a 403) the whole section stands down — no stray heading.
    await waitFor(() => {
      expect(mockGetActiveAnnouncements).toHaveBeenCalled();
    });

    expect(
      screen.queryByTestId('announcements-section')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId(CARD_TESTID)).not.toBeInTheDocument();
  });
});

describe('AnnouncementsRail rail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    window.sessionStorage.clear();
    mockGetActiveAnnouncements.mockResolvedValue({
      data: [
        makeAnnouncement('a1'),
        makeAnnouncement('a2'),
        makeAnnouncement('a3'),
      ],
    } as never);
    mockListAnnouncements.mockResolvedValue({ data: [] } as never);
  });

  it('lays every active announcement out in the rail', async () => {
    renderWithQueryClient(<AnnouncementsRail />);

    await waitFor(() => {
      expect(screen.getByTestId(cardId('a1'))).toBeInTheDocument();
    });

    expect(screen.getByTestId(cardId('a2'))).toBeInTheDocument();
    expect(screen.getByTestId(cardId('a3'))).toBeInTheDocument();
  });

  it('scrolls the rail by a page on next and previous', async () => {
    renderWithQueryClient(<AnnouncementsRail />);

    await waitFor(() => {
      expect(screen.getByTestId(cardId('a1'))).toBeInTheDocument();
    });

    const rail = stubRailGeometry({ clientWidth: 400 });

    fireEvent.click(screen.getByTestId(NEXT_BTN));

    expect(rail.scrollBy).toHaveBeenCalledWith({
      behavior: 'smooth',
      left: 360,
    });

    // `scrollBy` is a spy, so move the rail by hand before paging back —
    // previous stays disabled while the rail sits at its start.
    Object.defineProperty(rail, 'scrollLeft', {
      configurable: true,
      value: 360,
      writable: true,
    });
    fireEvent.scroll(rail);

    fireEvent.click(screen.getByTestId(PREV_BTN));

    expect(rail.scrollBy).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      left: -360,
    });
  });

  it('disables previous at the start of the rail and next at the end', async () => {
    renderWithQueryClient(<AnnouncementsRail />);

    await waitFor(() => {
      expect(screen.getByTestId(cardId('a1'))).toBeInTheDocument();
    });

    const rail = stubRailGeometry({ clientWidth: 400, scrollWidth: 1200 });

    expect(screen.getByTestId(PREV_BTN)).toBeDisabled();
    expect(screen.getByTestId(NEXT_BTN)).not.toBeDisabled();

    // Scrolled to the far end: 1200 - 400.
    Object.defineProperty(rail, 'scrollLeft', {
      configurable: true,
      value: 800,
      writable: true,
    });
    fireEvent.scroll(rail);

    expect(screen.getByTestId(PREV_BTN)).not.toBeDisabled();
    expect(screen.getByTestId(NEXT_BTN)).toBeDisabled();
  });

  it('hides the pager for a single announcement but keeps view all', async () => {
    mockGetActiveAnnouncements.mockResolvedValue({
      data: [makeAnnouncement('solo')],
    } as never);

    renderWithQueryClient(<AnnouncementsRail />);

    await waitFor(() => {
      expect(screen.getByTestId(cardId('solo'))).toBeInTheDocument();
    });

    expect(screen.queryByTestId(NEXT_BTN)).not.toBeInTheDocument();
    expect(screen.queryByTestId(PREV_BTN)).not.toBeInTheDocument();
    expect(screen.getByTestId(VIEW_ALL_BTN)).toBeInTheDocument();
  });

  it('hides the whole section when nothing is active', async () => {
    mockGetActiveAnnouncements.mockResolvedValue({ data: [] } as never);

    renderWithQueryClient(<AnnouncementsRail />);

    await waitFor(() => {
      expect(mockGetActiveAnnouncements).toHaveBeenCalled();
    });

    expect(
      screen.queryByTestId('announcements-section')
    ).not.toBeInTheDocument();
  });

  it('removes a dismissed announcement from the rail', async () => {
    renderWithQueryClient(<AnnouncementsRail />);

    await waitFor(() => {
      expect(screen.getByTestId(cardId('a1'))).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByLabelText(DISMISS_LABEL)[0]);

    expect(screen.queryByTestId(cardId('a1'))).not.toBeInTheDocument();
    expect(screen.getByTestId(cardId('a2'))).toBeInTheDocument();
  });
});

describe('AnnouncementsRail type badge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    window.sessionStorage.clear();
    mockListAnnouncements.mockResolvedValue({ data: [] } as never);
  });

  const renderWithType = async (overrides: Partial<AnnouncementEntity>) => {
    mockGetActiveAnnouncements.mockResolvedValue({
      data: [makeAnnouncement('a1', overrides)],
    } as never);

    renderWithQueryClient(<AnnouncementsRail />);

    await waitFor(() => {
      expect(screen.getByTestId(cardId('a1'))).toBeInTheDocument();
    });
  };

  // These read through the real `AnnouncementsUtils`, not a mock, so a drift in
  // OpenMetadata's type table fails here rather than passing against a stub.
  it.each([
    [AnnouncementType.Critical, 'label.critical'],
    [AnnouncementType.Notice, 'label.notice'],
    [AnnouncementType.Warning, 'label.warning'],
    [AnnouncementType.Deprecation, 'label.deprecation'],
  ])('badges a %s announcement with the shared label', async (type, label) => {
    await renderWithType({ type });

    expect(screen.getByTestId(TYPE_BADGE)).toHaveTextContent(label);
  });

  it('falls back to the schema default when no type is stored', async () => {
    await renderWithType({});

    expect(screen.getByTestId(TYPE_BADGE)).toHaveTextContent('label.notice');
  });

  it('shows a custom announcement by its own name', async () => {
    await renderWithType({
      type: AnnouncementType.Custom,
      customTypeName: 'Release',
    });

    expect(screen.getByTestId(TYPE_BADGE)).toHaveTextContent('Release');
  });

  it('leaves a live announcement unlabelled but dismissible', async () => {
    await renderWithType({});

    // The rail only shows live announcements, so a status pill there would name
    // what the surrounding section already says.
    expect(screen.queryByTestId('announcement-status')).not.toBeInTheDocument();
    expect(screen.getByLabelText(DISMISS_LABEL)).toBeInTheDocument();
  });
});

describe('AnnouncementsRail all-announcements dialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    window.sessionStorage.clear();
    mockGetActiveAnnouncements.mockResolvedValue({
      data: [makeAnnouncement('a1')],
    } as never);
    mockListAnnouncements.mockResolvedValue({
      data: [
        makeAnnouncement('old', EXPIRED_WINDOW),
        makeAnnouncement('a1'),
        makeAnnouncement('soon', SCHEDULED_WINDOW),
      ],
    } as never);
  });

  const openDialog = async () => {
    renderWithQueryClient(<AnnouncementsRail />);

    await waitFor(() => {
      expect(screen.getByTestId(cardId('a1'))).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(VIEW_ALL_BTN));

    await waitFor(() => {
      expect(screen.getByTestId('all-announcements-list')).toBeInTheDocument();
    });
  };

  it('fetches the full list only once opened', async () => {
    renderWithQueryClient(<AnnouncementsRail />);

    await waitFor(() => {
      expect(screen.getByTestId(cardId('a1'))).toBeInTheDocument();
    });

    expect(mockListAnnouncements).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId(VIEW_ALL_BTN));

    await waitFor(() => {
      expect(mockListAnnouncements).toHaveBeenCalledTimes(1);
    });
  });

  it('lists expired and scheduled announcements the rail leaves out', async () => {
    await openDialog();

    const list = screen.getByTestId('all-announcements-list');

    expect(list).toContainElement(screen.getByTestId(cardId('old')));
    expect(list).toContainElement(screen.getByTestId(cardId('soon')));
    // Active first, then Scheduled, then Expired.
    expect(
      Array.from(list.children).map((li) =>
        li.firstElementChild?.getAttribute('data-testid')
      )
    ).toEqual([cardId('a1'), cardId('soon'), cardId('old')]);
  });

  it('offers no dismiss on announcements that are no longer live', async () => {
    await openDialog();

    const expired = screen.getByTestId(cardId('old'));
    const scheduled = screen.getByTestId(cardId('soon'));

    expect(expired).toHaveTextContent('label.in-active');
    expect(scheduled).toHaveTextContent('label.scheduled');
    expect(
      expired.querySelector(`[aria-label="${DISMISS_LABEL}"]`)
    ).not.toBeInTheDocument();
    expect(
      scheduled.querySelector(`[aria-label="${DISMISS_LABEL}"]`)
    ).not.toBeInTheDocument();
  });

  it('keeps a dismissal from the rail out of the dialog', async () => {
    await openDialog();

    // The rail copy and the dialog copy of `a1` share one dismissed-id set.
    fireEvent.click(screen.getAllByLabelText(DISMISS_LABEL)[0]);

    expect(screen.queryByTestId(cardId('a1'))).not.toBeInTheDocument();
  });
});
