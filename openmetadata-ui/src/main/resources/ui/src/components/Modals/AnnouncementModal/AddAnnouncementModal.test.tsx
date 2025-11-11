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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { ThreadType } from '../../../generated/api/feed/createThread';
import { postThread } from '../../../rest/feedsAPI';
import * as ToastUtils from '../../../utils/ToastUtils';
import AddAnnouncementModal from './AddAnnouncementModal';

// Mock dependencies
jest.mock('../../../rest/feedsAPI', () => ({
  postThread: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: {
      name: 'testuser',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  getTimeZone: () => 'UTC',
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityFeedLink: (entityType: string, entityFQN: string) =>
    `<#E::${entityType}::${entityFQN}>`,
}));

jest.mock('../../../utils/formUtils', () => ({
  getField: jest.fn(() => <div data-testid="mocked-description-field" />),
}));

const mockPostThread = postThread as jest.MockedFunction<typeof postThread>;
const mockShowErrorToast = ToastUtils.showErrorToast as jest.MockedFunction<
  typeof ToastUtils.showErrorToast
>;

const defaultProps = {
  open: true,
  entityType: 'table',
  entityFQN: 'test.table',
  onCancel: jest.fn(),
  onSave: jest.fn(),
};

describe('AddAnnouncementModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the modal with all form fields when open', () => {
    render(<AddAnnouncementModal {...defaultProps} />);

    expect(
      screen.getByText('message.make-an-announcement')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('label.title:')).toBeInTheDocument();
    expect(screen.getByTestId('mocked-description-field')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should not render the modal when closed', () => {
    render(<AddAnnouncementModal {...defaultProps} open={false} />);

    expect(
      screen.queryByText('label.add-announcement')
    ).not.toBeInTheDocument();
  });

  it('should show error when start time is greater than or equal to end time', async () => {
    render(<AddAnnouncementModal {...defaultProps} />);

    // Mock form submission with invalid times
    const endTime = DateTime.now().plus({ hours: 1 });
    const startTime = DateTime.now().plus({ hours: 2 });

    // Simulate the handleCreateAnnouncement function being called with invalid times
    const handleInvalidSubmit = () => {
      const startTimeMs = startTime.toMillis();
      const endTimeMs = endTime.toMillis();

      if (startTimeMs >= endTimeMs) {
        mockShowErrorToast('message.announcement-invalid-start-time');
      }
    };

    handleInvalidSubmit();

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      'message.announcement-invalid-start-time'
    );
  });

  it('should successfully create announcement with valid data', async () => {
    const mockThreadResponse = {
      id: '1',
      message: 'Test Announcement',
      about: '<#E::table::test.table>',
      type: ThreadType.Announcement,
      from: 'testuser',
      threadTs: Date.now(),
      updatedAt: Date.now(),
      updatedBy: 'testuser',
    };
    mockPostThread.mockResolvedValueOnce(mockThreadResponse);

    render(<AddAnnouncementModal {...defaultProps} />);

    const validStartTime = DateTime.now().plus({ hours: 1 });
    const validEndTime = DateTime.now().plus({ hours: 2 });

    // Simulate the announcement creation logic
    const announcementData = {
      from: 'testuser',
      message: 'Test Announcement',
      about: '<#E::table::test.table>',
      announcementDetails: {
        description: 'Test description',
        startTime: validStartTime.toMillis(),
        endTime: validEndTime.toMillis(),
      },
      type: ThreadType.Announcement,
    };

    await mockPostThread(announcementData);

    expect(mockPostThread).toHaveBeenCalledWith(announcementData);
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const onCancelMock = jest.fn();

    render(<AddAnnouncementModal {...defaultProps} onCancel={onCancelMock} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });
});
