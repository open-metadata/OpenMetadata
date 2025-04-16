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

jest.mock('../../../Announcement/AnnouncementThreadBody.component', () => {
  return jest.fn().mockReturnValue(<div>AnnouncementThreadBody</div>);
});

jest.mock('../../../Modals/AnnouncementModal/AddAnnouncementModal', () => {
  return jest.fn().mockReturnValue(<div>AddAnnouncementModal</div>);
});

const mockProps = {
  open: true,
  entityType: 'string',
  entityFQN: 'string',
  onClose: jest.fn(),
  createPermission: true,
};

describe('Test Announcement drawer component', () => {
  it('Should render the component', async () => {
    render(<AnnouncementDrawer {...mockProps} />);

    const announcementHeader = screen.getByText('label.announcement-plural');
    const addAnnouncementButton = screen.getByTestId('add-announcement');

    const addButton = screen.getByTestId('add-announcement');

    const announcements = screen.getByText('AnnouncementThreadBody');

    expect(announcementHeader).toBeInTheDocument();
    expect(addAnnouncementButton).toBeInTheDocument();
    expect(addButton).toBeInTheDocument();
    expect(announcements).toBeInTheDocument();
  });

  it('Should be disabled if not having permission to create', async () => {
    render(<AnnouncementDrawer {...mockProps} createPermission={false} />);

    const addButton = screen.getByTestId('add-announcement');

    expect(addButton).toBeDisabled();
  });

  it('Should open modal on click of add button', async () => {
    render(<AnnouncementDrawer {...mockProps} />);

    const addButton = screen.getByTestId('add-announcement');

    fireEvent.click(addButton);

    expect(await screen.findByText('AddAnnouncementModal')).toBeInTheDocument();
  });
});
