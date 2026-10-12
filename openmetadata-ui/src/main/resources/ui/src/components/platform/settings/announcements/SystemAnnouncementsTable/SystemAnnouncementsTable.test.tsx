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
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  AnnouncementStatus,
  AnnouncementType,
} from '../../../../../generated/entity/feed/announcement';
import { SystemAnnouncementsListState } from '../../../../../hooks/platform/useSystemAnnouncements';
import {
  AnnouncementEntity,
  deleteAnnouncement,
} from '../../../../../rest/announcementsAPI';
import { renderWithQueryClient } from '../../../../../test/unit/test-utils';
import SystemAnnouncementsTable from './SystemAnnouncementsTable';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../rest/announcementsAPI', () => ({
  deleteAnnouncement: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: () => <span data-testid="profile-picture" />,
}));

jest.mock('../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const DAY = 86_400_000;
const now = Date.now();

const makeAnnouncement = (
  id: string,
  overrides: Partial<AnnouncementEntity> = {}
): AnnouncementEntity => ({
  id,
  name: `announcement-${id}`,
  displayName: `Title ${id}`,
  description: 'Body',
  startTime: now - DAY,
  endTime: now + DAY,
  type: AnnouncementType.Notice,
  createdBy: 'admin',
  ...overrides,
});

const makeList = (
  overrides: Partial<SystemAnnouncementsListState> = {}
): SystemAnnouncementsListState => ({
  announcements: [],
  filters: { search: '' },
  hasFilters: false,
  isError: false,
  isLoading: false,
  page: 1,
  pageCount: 1,
  pageSize: 10,
  total: 0,
  clearFilters: jest.fn(),
  goToPage: jest.fn(),
  refetch: jest.fn(),
  setPageSize: jest.fn(),
  updateFilters: jest.fn(),
  ...overrides,
});

const callbacks = {
  onAdd: jest.fn(),
  onDuplicate: jest.fn(),
  onEdit: jest.fn(),
};

describe('SystemAnnouncementsTable', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists each announcement with its type, author and status derived from its window', () => {
    const announcements = [
      makeAnnouncement('live', { type: AnnouncementType.Critical }),
      makeAnnouncement('later', {
        startTime: now + DAY,
        endTime: now + 2 * DAY,
      }),
      makeAnnouncement('past', {
        startTime: now - 2 * DAY,
        endTime: now - DAY,
        // A stored snapshot that has since gone stale: the window decides.
        status: AnnouncementStatus.Active,
      }),
    ];

    renderWithQueryClient(
      <SystemAnnouncementsTable
        list={makeList({ announcements, total: 3 })}
        {...callbacks}
      />
    );

    expect(screen.getByText('Title live')).toBeInTheDocument();
    expect(screen.getByText('label.critical')).toBeInTheDocument();
    expect(screen.getAllByText('admin')).toHaveLength(3);
    expect(
      within(
        screen.getByTestId('announcement-row-announcement-live')
      ).getByText('label.active')
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId('announcement-row-announcement-later')
      ).getByText('label.scheduled')
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId('announcement-row-announcement-past')
      ).getByText('label.expired')
    ).toBeInTheDocument();
  });

  it('opens the announcement for edit from its title', () => {
    const announcement = makeAnnouncement('a1');

    renderWithQueryClient(
      <SystemAnnouncementsTable
        list={makeList({ announcements: [announcement], total: 1 })}
        {...callbacks}
      />
    );

    fireEvent.click(screen.getByTestId('announcement-title-announcement-a1'));

    expect(callbacks.onEdit).toHaveBeenCalledWith(announcement);
  });

  it('sends the search to the list, which filters on the server', () => {
    const list = makeList();

    renderWithQueryClient(
      <SystemAnnouncementsTable list={list} {...callbacks} />
    );

    fireEvent.change(screen.getByPlaceholderText('label.search-for-type…'), {
      target: { value: 'maintenance' },
    });

    expect(list.updateFilters).toHaveBeenCalledWith({ search: 'maintenance' });
  });

  it('offers Add from the empty state when nothing exists yet', () => {
    renderWithQueryClient(
      <SystemAnnouncementsTable list={makeList()} {...callbacks} />
    );

    expect(screen.getByTestId('announcements-empty')).toBeInTheDocument();

    fireEvent.click(screen.getByText('label.add-entity'));

    expect(callbacks.onAdd).toHaveBeenCalled();
  });

  it('says nothing matched, with a way to clear, when filters exclude everything', () => {
    const list = makeList({
      filters: { search: 'zzz' },
      hasFilters: true,
    });

    renderWithQueryClient(
      <SystemAnnouncementsTable list={list} {...callbacks} />
    );

    expect(screen.getByTestId('announcements-no-match')).toBeInTheDocument();
    expect(screen.queryByTestId('announcements-empty')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('announcement-clear-filters'));

    expect(list.clearFilters).toHaveBeenCalled();
  });

  it('duplicates a row through its actions menu', async () => {
    const announcement = makeAnnouncement('a1');

    renderWithQueryClient(
      <SystemAnnouncementsTable
        list={makeList({ announcements: [announcement], total: 1 })}
        {...callbacks}
      />
    );

    fireEvent.click(screen.getByTestId('announcement-actions-announcement-a1'));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'label.duplicate' })
    );

    expect(callbacks.onDuplicate).toHaveBeenCalledWith(announcement);
  });

  it('hard-deletes a row only after it is confirmed', async () => {
    renderWithQueryClient(
      <SystemAnnouncementsTable
        list={makeList({ announcements: [makeAnnouncement('a1')], total: 1 })}
        {...callbacks}
      />
    );

    fireEvent.click(screen.getByTestId('announcement-actions-announcement-a1'));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'label.delete' })
    );

    expect(
      await screen.findByTestId('announcement-delete-confirm')
    ).toBeInTheDocument();
    expect(deleteAnnouncement).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('save-button'));

    await waitFor(() =>
      expect(deleteAnnouncement).toHaveBeenCalledWith('a1', true)
    );
  });

  it('pages only when there is more than one page', () => {
    const { rerender } = renderWithQueryClient(
      <SystemAnnouncementsTable
        list={makeList({ announcements: [makeAnnouncement('a1')], total: 1 })}
        {...callbacks}
      />
    );

    expect(screen.queryByText('label.next')).not.toBeInTheDocument();

    rerender(
      <SystemAnnouncementsTable
        list={makeList({
          announcements: [makeAnnouncement('a1')],
          total: 25,
          pageCount: 3,
        })}
        {...callbacks}
      />
    );

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
