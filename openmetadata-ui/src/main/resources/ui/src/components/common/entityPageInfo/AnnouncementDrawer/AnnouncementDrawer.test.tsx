/*
 *  Copyright 2022 Collate.
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
import React from 'react';
import AnnouncementDrawer from './AnnouncementDrawer';

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityFeedLink: jest.fn(),
}));

jest.mock('../../../../utils/FeedUtils', () => ({
  deletePost: jest.fn(),
  updateThreadData: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock(
  '../../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanelBody',
  () => {
    return jest.fn().mockReturnValue(<div>ActivityThreadPanelBody</div>);
  }
);

jest.mock('../../../Modals/AnnouncementModal/AddAnnouncementModal', () => {
  return jest.fn().mockReturnValue(<div>AddAnnouncementModal</div>);
});

jest.mock('../../../../AppState', () => ({
  userDetails: {
    name: '',
  },
  users: [{ name: '' }],
  getCurrentUserDetails: jest.fn(),
  isProfilePicLoading: jest.fn(),
}));

const mockProps = {
  open: true,
  entityType: 'string',
  entityFQN: 'string',
  entityName: 'string',
  onClose: jest.fn(),
};

describe('Test Announcement drawer component', () => {
  it('Should render the component', async () => {
    render(<AnnouncementDrawer {...mockProps} />);

    const drawer = await screen.findByTestId('announcement-drawer');

    const addButton = await screen.findByTestId('add-announcement');

    const announcements = await screen.findByText('ActivityThreadPanelBody');

    expect(drawer).toBeInTheDocument();
    expect(addButton).toBeInTheDocument();
    expect(announcements).toBeInTheDocument();
  });

  it('Should open modal on click of add button', async () => {
    render(<AnnouncementDrawer {...mockProps} />);

    const addButton = await screen.findByTestId('add-announcement');

    fireEvent.click(addButton);

    expect(await screen.findByText('AddAnnouncementModal')).toBeInTheDocument();
  });
});
