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

import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  AnnouncementColor,
  AnnouncementType,
} from '../../../generated/entity/feed/announcement';
import * as ToastUtils from '../../../utils/ToastUtils';
import { AnnouncementFormValues } from './AnnouncementModal.interface';
import EditAnnouncementModal from './EditAnnouncementModal';

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The form body has its own test; here it is a harness that submits whatever
// values a case wants, so these assertions stay on what the modal confirms.
let submittedValues: AnnouncementFormValues;

jest.mock('./AnnouncementForm.component', () => ({
  __esModule: true,
  default: ({
    open,
    title,
    onCancel,
    onSubmit,
  }: {
    open: boolean;
    title: string;
    onCancel: () => void;
    onSubmit: (values: AnnouncementFormValues) => void;
  }) =>
    open ? (
      <div data-testid="announcement-form">
        <span>{title}</span>
        <button data-testid="submit" onClick={() => onSubmit(submittedValues)}>
          submit
        </button>
        <button data-testid="cancel" onClick={onCancel}>
          cancel
        </button>
      </div>
    ) : null,
}));

const mockShowErrorToast = ToastUtils.showErrorToast as jest.MockedFunction<
  typeof ToastUtils.showErrorToast
>;

const START = 1700000000000;
const END = START + 86400000;

const mockAnnouncement = {
  description: 'Test announcement description',
  startTime: START,
  endTime: END,
};

const defaultProps = {
  open: true,
  announcementTitle: 'Test Announcement Title',
  announcement: mockAnnouncement,
  onCancel: jest.fn(),
  onConfirm: jest.fn(),
};

const baseValues: AnnouncementFormValues = {
  title: 'Updated title',
  description: 'Updated description',
  announcementType: AnnouncementType.Warning,
  startTime: START,
  endTime: END,
};

describe('EditAnnouncementModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    submittedValues = { ...baseValues };
  });

  it('should render the form when open', () => {
    render(<EditAnnouncementModal {...defaultProps} />);

    expect(screen.getByTestId('announcement-form')).toBeInTheDocument();
    expect(screen.getByText('label.edit-an-announcement')).toBeInTheDocument();
  });

  it('should not render the form when closed', () => {
    render(<EditAnnouncementModal {...defaultProps} open={false} />);

    expect(screen.queryByTestId('announcement-form')).not.toBeInTheDocument();
  });

  it('should reject a start time that is not before the end time', async () => {
    submittedValues = { ...baseValues, startTime: END, endTime: START };

    render(<EditAnnouncementModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit'));
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      'message.announcement-invalid-start-time'
    );
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it('should confirm the updated announcement with its type', async () => {
    render(<EditAnnouncementModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit'));
    });

    expect(defaultProps.onConfirm).toHaveBeenCalledWith('Updated title', {
      description: 'Updated description',
      startTime: START,
      endTime: END,
      announcementType: AnnouncementType.Warning,
      color: undefined,
    });
  });

  it('should keep the colour only for a Custom announcement', async () => {
    submittedValues = {
      ...baseValues,
      announcementType: AnnouncementType.Custom,
      color: AnnouncementColor.Pink,
    };

    render(<EditAnnouncementModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit'));
    });

    expect(defaultProps.onConfirm).toHaveBeenCalledWith(
      'Updated title',
      expect.objectContaining({
        announcementType: AnnouncementType.Custom,
        color: AnnouncementColor.Pink,
      })
    );
  });

  it('should call onCancel when cancel is clicked', async () => {
    const onCancelMock = jest.fn();

    render(<EditAnnouncementModal {...defaultProps} onCancel={onCancelMock} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('cancel'));
    });

    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });
});
