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
import { AnnouncementType } from '../../../generated/entity/feed/announcement';
import { createAnnouncement } from '../../../rest/announcementsAPI';
import * as ToastUtils from '../../../utils/ToastUtils';
import AddAnnouncementModal from './AddAnnouncementModal';
import { AnnouncementFormValues } from './AnnouncementModal.interface';

jest.mock('../../../rest/announcementsAPI', () => ({
  createAnnouncement: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../utils/EntityPureUtils', () => ({
  getEntityFeedLink: (entityType: string, entityFQN: string) =>
    `<#E::${entityType}::${entityFQN}>`,
}));

// The form body has its own test; here it is a harness that submits whatever
// values a case wants, so these assertions stay on the payload the modal builds.
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

const mockCreateAnnouncement = createAnnouncement as jest.MockedFunction<
  typeof createAnnouncement
>;
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

const START = 1700000000000;
const END = START + 86400000;

const baseValues: AnnouncementFormValues = {
  title: 'Test Announcement',
  description: 'Test description',
  announcementType: AnnouncementType.Notice,
  startTime: START,
  endTime: END,
};

describe('AddAnnouncementModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    submittedValues = { ...baseValues };
  });

  it('should render the form when open', () => {
    render(<AddAnnouncementModal {...defaultProps} />);

    expect(screen.getByTestId('announcement-form')).toBeInTheDocument();
    expect(
      screen.getByText('message.make-an-announcement')
    ).toBeInTheDocument();
  });

  it('should not render the form when closed', () => {
    render(<AddAnnouncementModal {...defaultProps} open={false} />);

    expect(screen.queryByTestId('announcement-form')).not.toBeInTheDocument();
  });

  it('should reject a start time that is not before the end time', async () => {
    submittedValues = { ...baseValues, startTime: END, endTime: START };

    render(<AddAnnouncementModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit'));
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      'message.announcement-invalid-start-time'
    );
    expect(mockCreateAnnouncement).not.toHaveBeenCalled();
  });

  it('should post the announcement with its type', async () => {
    mockCreateAnnouncement.mockResolvedValueOnce({
      id: '1',
      name: 'announcement-1',
      description: 'Test description',
      startTime: START,
      endTime: END,
    });

    render(<AddAnnouncementModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit'));
    });

    expect(mockCreateAnnouncement).toHaveBeenCalledWith({
      displayName: 'Test Announcement',
      description: 'Test description',
      entityLink: '<#E::table::test.table>',
      startTime: START,
      endTime: END,
      announcementType: AnnouncementType.Notice,
      color: undefined,
    });
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
  });

  it('should only send a colour for a Custom announcement', async () => {
    mockCreateAnnouncement.mockResolvedValue({
      id: '1',
      name: 'announcement-1',
      description: 'Test description',
      startTime: START,
      endTime: END,
    });
    submittedValues = {
      ...baseValues,
      announcementType: AnnouncementType.Critical,
      color: undefined,
    };

    render(<AddAnnouncementModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit'));
    });

    expect(mockCreateAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({
        announcementType: AnnouncementType.Critical,
        color: undefined,
      })
    );
  });

  it('should call onCancel when cancel is clicked', async () => {
    const onCancelMock = jest.fn();

    render(<AddAnnouncementModal {...defaultProps} onCancel={onCancelMock} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('cancel'));
    });

    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });
});
