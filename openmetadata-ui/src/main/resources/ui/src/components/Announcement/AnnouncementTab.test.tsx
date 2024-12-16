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
const mockData = {
  data: [
    {
      id: 'c47dca52-ede3-4caa-95fc-1bf7c09c4b8b',
      type: 'Announcement',
      href: 'testref',
      threadTs: 1734104175006,
      about: '<#E::databaseService::mysql_sample>',
      entityRef: {
        id: 'dd72c57f-90d4-4d44-a28e-fcce022da01d',
        type: 'databaseService',
        name: 'mysql_sample',
        fullyQualifiedName: 'mysql_sample',
        displayName: 'mysql_sample',
        deleted: false,
      },
      generatedBy: 'user',
      cardStyle: 'default',
      fieldOperation: 'updated',
      createdBy: 'admin',
      updatedAt: 1734165381233,
      updatedBy: 'admin',
      resolved: false,
      message: 'test message 1',
      postsCount: 2,
      posts: [
        {
          id: 'eed48d1d-1a2f-4010-93a1-1e58abe655c9',
          message: 'test post 1',
          postTs: 1734104788080,
          from: 'admin',
          reactions: [],
        },
        {
          id: 'b5489fd3-ef45-46db-b547-e25744d41e7a',
          message: 'test post 2',
          postTs: 1734165309885,
          from: 'admin',
          reactions: [],
        },
      ],
      reactions: [
        {
          reactionType: 'hooray',
          user: {
            id: '749ade20-3e65-4e49-8974-adfbd7a83996',
            type: 'user',
            name: 'admin',
            fullyQualifiedName: 'admin',
            displayName: 'admin',
            deleted: false,
          },
        },
      ],
      announcement: {
        description: 'test announcement 1',
        startTime: 1734276969000,
        endTime: 1734536171000,
      },
    },
  ],
  paging: {
    total: 1,
  },
};

describe('AnnouncementTab', () => {
  const defaultProps = {
    fqn: 'mysql_sample',
    entityType: 'databaseService',
    permissions: { EditAll: true } as OperationPermission,
  } as AnnouncementTabProps;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component', () => {
    render(<AnnouncementTab {...defaultProps} />);

    expect(screen.getByTestId('active-announcement')).toBeInTheDocument();
    expect(screen.getByTestId('inactive-announcement')).toBeInTheDocument();
    expect(screen.getByTestId('add-announcement-btn')).toBeInTheDocument();
  });

  it('should fetch and display announcements correctly', async () => {
    mockGetAnnouncements.mockResolvedValueOnce(mockData);

    render(
      <MemoryRouter>
        <AnnouncementTab {...defaultProps} />
      </MemoryRouter>
    );

    const announcementMessage = await screen.findAllByText(
      'test announcement 1'
    );

    expect(announcementMessage[0]).toBeInTheDocument();
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

    const activeFilterButton = screen.getByTestId('active-announcement');
    fireEvent.click(activeFilterButton);
    mockGetAnnouncements.mockResolvedValueOnce(mockData);
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
    const inactiveFilterButton = screen.getByTestId('inactive-announcement');
    fireEvent.click(inactiveFilterButton);
    mockGetAnnouncements.mockResolvedValueOnce(mockData);
    await waitFor(() =>
      expect(mockGetAnnouncements).toHaveBeenCalledWith(
        false,
        '<#E::databaseService::mysql_sample>'
      )
    );
  });

  it('updates selected announcement and displays its details and post replies in right panel', async () => {
    mockGetAnnouncements.mockResolvedValueOnce(mockData);

    render(
      <MemoryRouter>
        <AnnouncementTab {...defaultProps} />
      </MemoryRouter>
    );

    const announcementMessage = await screen.findAllByText(
      'test announcement 1'
    );
    fireEvent.click(announcementMessage[0]);

    expect(screen.getByText('test post 1')).toBeInTheDocument();
    expect(screen.getByText('test post 2')).toBeInTheDocument();

    expect(announcementMessage[0]).toBeInTheDocument();
  });
});
