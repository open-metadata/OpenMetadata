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

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { mockShowErrorToast } from '../../../mocks/CustomizablePage.mock';
import EditAnnouncementModal from './EditAnnouncementModal';

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: mockShowErrorToast,
}));

jest.mock('../../common/RichTextEditor/RichTextEditor', () => {
  return jest.fn().mockReturnValue(<div>RichTextEditor</div>);
});

const mockUpdateAnnouncement = jest.fn();

jest.mock(
  '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn().mockImplementation(() => ({
      selectedThread: {
        message: 'announcement title',
        announcement: {
          description: '',
          startTime: 1678900280,
          endTime: 1678900780,
        },
      },
      updateAnnouncement: () => {
        mockUpdateAnnouncement();
      },
    })),
  })
);

const onCancel = jest.fn();

const mockProps = {
  open: true,
  onCancel,
};

describe('Test Edit Announcement modal', () => {
  it('Should render the component', async () => {
    render(<EditAnnouncementModal {...mockProps} />);

    const modal = await screen.findByTestId('edit-announcement');

    const form = await screen.findByTestId('announcement-form');

    expect(modal).toBeInTheDocument();

    expect(form).toBeInTheDocument();
  });

  it('Cancel should work', async () => {
    render(<EditAnnouncementModal {...mockProps} />);

    const cancelButton = await screen.findByText('Cancel');

    userEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('on submit should call the updateAnnouncement', async () => {
    render(<EditAnnouncementModal {...mockProps} />);

    const saveButton = await screen.findByText('label.save');

    userEvent.click(saveButton);

    expect(mockUpdateAnnouncement).toHaveBeenCalled();
  });
});
