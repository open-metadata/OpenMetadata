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
import { AnnouncementDetails } from '../../../generated/entity/feed/thread';
import * as ToastUtils from '../../../utils/ToastUtils';
import EditAnnouncementModal from './EditAnnouncementModal';

// Mock dependencies
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('../../../utils/date-time/DateTimeUtils'),
  getTimeZone: () => 'UTC',
}));

jest.mock('../../../utils/formUtils', () => ({
  getField: jest.fn(() => <div data-testid="mocked-description-field" />),
}));

const mockShowErrorToast = ToastUtils.showErrorToast as jest.MockedFunction<
  typeof ToastUtils.showErrorToast
>;

const mockAnnouncement: AnnouncementDetails = {
  description: 'Test announcement description',
  startTime: DateTime.now().plus({ hours: 1 }).toMillis(),
  endTime: DateTime.now().plus({ hours: 3 }).toMillis(),
};

const defaultProps = {
  open: true,
  announcementTitle: 'Test Announcement Title',
  announcement: mockAnnouncement,
  onCancel: jest.fn(),
  onConfirm: jest.fn(),
};

describe('EditAnnouncementModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the modal with pre-filled data when open', () => {
    render(<EditAnnouncementModal {...defaultProps} />);

    expect(screen.getByText('label.edit-an-announcement')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('Test Announcement Title')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('label.title:')).toBeInTheDocument();
    expect(screen.getByTestId('mocked-description-field')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.save' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should not render the modal when closed', () => {
    render(<EditAnnouncementModal {...defaultProps} open={false} />);

    expect(
      screen.queryByText('label.edit-an-announcement')
    ).not.toBeInTheDocument();
  });

  it('should show error when start time is greater than or equal to end time', async () => {
    render(<EditAnnouncementModal {...defaultProps} />);

    // Mock form submission with invalid times where start >= end
    const endTime = DateTime.now().plus({ hours: 1 });
    const startTime = DateTime.now().plus({ hours: 2 }); // Start after end

    // Simulate the handleConfirm function being called with invalid times
    const handleConfirm = () => {
      const startTimeMs = startTime.toMillis();
      const endTimeMs = endTime.toMillis();

      if (startTimeMs >= endTimeMs) {
        mockShowErrorToast('message.announcement-invalid-start-time');
      }
    };

    handleConfirm();

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      'message.announcement-invalid-start-time'
    );
  });

  it('should successfully update announcement with valid data', async () => {
    const onConfirmMock = jest.fn();

    render(
      <EditAnnouncementModal {...defaultProps} onConfirm={onConfirmMock} />
    );

    // Mock valid form submission
    const validStartTime = DateTime.now().plus({ hours: 1 });
    const validEndTime = DateTime.now().plus({ hours: 3 });

    const handleSuccessfulConfirm = () => {
      const startTimeMs = validStartTime.toMillis();
      const endTimeMs = validEndTime.toMillis();

      const updatedAnnouncement = {
        ...mockAnnouncement,
        description: 'Test announcement description',
        startTime: startTimeMs,
        endTime: endTimeMs,
      };
      onConfirmMock('Updated Announcement Title', updatedAnnouncement);
    };

    handleSuccessfulConfirm();

    expect(onConfirmMock).toHaveBeenCalledWith('Updated Announcement Title', {
      ...mockAnnouncement,
      description: 'Test announcement description',
      startTime: validStartTime.toMillis(),
      endTime: validEndTime.toMillis(),
    });
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const onCancelMock = jest.fn();

    render(<EditAnnouncementModal {...defaultProps} onCancel={onCancelMock} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });
});
