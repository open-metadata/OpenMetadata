/*
 *  Copyright 2024 Collate.
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { MOCK_ANNOUNCEMENT_DATA } from '../../mocks/Announcement.mock';
import { getAnnouncements } from '../../rest/feedsAPI';
import AnnouncementTab from './AnnouncementTab.component';

jest.mock('../../rest/feedsAPI');
jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: { name: 'admin' },
    userProfilePics: {
      admin: 'mock-profile-pic-url',
    },
  }),
}));
jest.useRealTimers();
jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockGetAnnouncements = getAnnouncements as jest.Mock;

interface AnnouncementTabProps {
  fqn: string;
  entityType: EntityType;
  permissions: OperationPermission;
}

describe('AnnouncementTab', () => {
  const defaultProps = {
    fqn: 'mysql_sample',
    entityType: 'databaseService',
    permissions: {
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
    } as OperationPermission,
  } as AnnouncementTabProps;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component', () => {
    render(<AnnouncementTab {...defaultProps} />);

    expect(screen.getByTestId('announcement-filter-icon')).toBeInTheDocument();
    expect(screen.getByTestId('add-announcement-btn')).toBeInTheDocument();
  });

  it('should open the modal when add announcement button is clicked', () => {
    render(<AnnouncementTab {...defaultProps} />);

    const addButton = screen.getByTestId('add-announcement-btn');
    fireEvent.click(addButton);

    expect(screen.getByTestId('add-announcement-modal')).toBeInTheDocument();
  });

  it('should call getAnnouncements with active param as true for active announcements filter click', async () => {
    render(
      <MemoryRouter>
        <AnnouncementTab {...defaultProps} />
      </MemoryRouter>
    );

    const filterButton = screen.getByTestId('announcement-filter-icon');
    filterButton.click();
    const activeFilterOption = screen.getByTestId('active-announcements');
    fireEvent.click(activeFilterOption);
    mockGetAnnouncements.mockResolvedValueOnce(MOCK_ANNOUNCEMENT_DATA);
    await waitFor(() =>
      expect(mockGetAnnouncements).toHaveBeenCalledWith(
        true,
        '<#E::databaseService::mysql_sample>'
      )
    );
  });

  it('should call getAnnouncements with active param as false for inactive announcements filter click', async () => {
    render(
      <MemoryRouter>
        <AnnouncementTab {...defaultProps} />
      </MemoryRouter>
    );
    const filterButton = screen.getByTestId('announcement-filter-icon');
    filterButton.click();
    const inactiveFilterButton = screen.getByTestId('inactive-announcements');
    fireEvent.click(inactiveFilterButton);
    mockGetAnnouncements.mockResolvedValueOnce(MOCK_ANNOUNCEMENT_DATA);
    await waitFor(() =>
      expect(mockGetAnnouncements).toHaveBeenCalledWith(
        false,
        '<#E::databaseService::mysql_sample>'
      )
    );
  });
});
