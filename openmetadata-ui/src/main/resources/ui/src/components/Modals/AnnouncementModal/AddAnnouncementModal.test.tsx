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
import AddAnnouncementModal from './AddAnnouncementModal';

jest.mock('../../../AppState', () => ({
  userDetails: {
    name: '',
  },
  nonSecureUserDetails: {
    name: '',
  },
  users: [{ name: '' }],
  getCurrentUserDetails: jest.fn(),
}));

jest.mock('rest/feedsAPI', () => ({
  postThread: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../utils/AnnouncementsUtils', () => ({
  validateMessages: {
    title: '',
  },
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityFeedLink: jest.fn(),
}));

jest.mock('../../../utils/TimeUtils', () => ({
  getUTCDateTime: jest.fn(),
  getTimeZone: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../common/rich-text-editor/RichTextEditor', () => {
  return jest.fn().mockReturnValue(<div>RichTextEditor</div>);
});

const onCancel = jest.fn();

const mockProps = {
  open: true,
  entityType: '',
  entityFQN: '',
  onCancel,
};

describe('Test Add Announcement modal', () => {
  it('Should render the component', async () => {
    render(<AddAnnouncementModal {...mockProps} />);

    const modal = await screen.findByTestId('add-announcement');

    const form = await screen.findByTestId('announcement-form');

    expect(modal).toBeInTheDocument();

    expect(form).toBeInTheDocument();
  });

  it('Cancel should work', async () => {
    render(<AddAnnouncementModal {...mockProps} />);

    const cancelButton = await screen.findByText('Cancel');

    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });
});
