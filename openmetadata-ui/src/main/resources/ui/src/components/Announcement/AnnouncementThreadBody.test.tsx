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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react-test-renderer';
import { AnnouncementStatus } from '../../generated/entity/feed/announcement';
import { MOCK_ANNOUNCEMENT_DATA } from '../../mocks/Announcement.mock';
import { listAnnouncements } from '../../rest/announcementsAPI';
import AnnouncementThreadBody from './AnnouncementThreadBody.component';

jest.mock('../../rest/announcementsAPI', () => ({
  listAnnouncements: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('./AnnouncementThreads', () =>
  jest
    .fn()
    .mockImplementation(
      ({ announcements, updateAnnouncementHandler, onConfirmation }) => (
        <>
          <p>AnnouncementThreads</p>
          <p data-testid="rendered-ids">
            {announcements.map((a: { id: string }) => a.id).join(',')}
          </p>
          <button
            onClick={() =>
              onConfirmation({
                state: true,
                threadId: 'threadId',
                postId: 'threadId',
                isThread: true,
              })
            }>
            ConfirmationButton
          </button>
          <button onClick={() => updateAnnouncementHandler('threadId', [])}>
            UpdateAnnouncementButton
          </button>
        </>
      )
    )
);

jest.mock('../Modals/ConfirmationModal/ConfirmationModal', () =>
  jest.fn().mockImplementation(({ visible, onConfirm, onCancel }) => (
    <>
      {visible ? 'Confirmation Modal is open' : 'Confirmation Modal is close'}
      <button onClick={onConfirm}>Confirm Confirmation Modal</button>
      <button onClick={onCancel}>Cancel Confirmation Modal</button>
    </>
  ))
);

jest.mock('../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockReturnValue(<p>ErrorPlaceHolder</p>)
);

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const baseAnnouncement = {
  name: 'announcement',
  displayName: 'Announcement',
  description: 'Description',
};

const mockProps = {
  threadLink: 'threadLink',
  refetchThread: false,
  editPermission: true,
  deleteAnnouncementHandler: jest.fn(),
  updateAnnouncementHandler: jest.fn(),
};

describe('AnnouncementThreadBody', () => {
  it('should call listAnnouncements when component mounts', async () => {
    render(<AnnouncementThreadBody {...mockProps} />);

    expect(listAnnouncements).toHaveBeenCalledWith({
      entityLink: 'threadLink',
      limit: 100,
      after: undefined,
    });
  });

  it('should render empty placeholder when no announcements are returned', async () => {
    await act(async () => {
      render(<AnnouncementThreadBody {...mockProps} />);
    });

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('should render announcement list and confirmation modal', async () => {
    (listAnnouncements as jest.Mock).mockResolvedValueOnce(
      MOCK_ANNOUNCEMENT_DATA
    );

    await act(async () => {
      render(<AnnouncementThreadBody {...mockProps} />);
    });

    expect(screen.getByTestId('announcement-thread-body')).toBeInTheDocument();
    expect(screen.getByText('AnnouncementThreads')).toBeInTheDocument();
    expect(screen.getByText('Confirmation Modal is close')).toBeInTheDocument();
  });

  it('should confirm delete with announcement id', async () => {
    (listAnnouncements as jest.Mock).mockResolvedValueOnce(
      MOCK_ANNOUNCEMENT_DATA
    );

    await act(async () => {
      render(<AnnouncementThreadBody {...mockProps} />);
    });

    fireEvent.click(screen.getByText('ConfirmationButton'));
    fireEvent.click(screen.getByText('Confirm Confirmation Modal'));

    expect(mockProps.deleteAnnouncementHandler).toHaveBeenCalledWith(
      'threadId'
    );
  });

  it('should trigger updateAnnouncementHandler', async () => {
    (listAnnouncements as jest.Mock).mockResolvedValueOnce(
      MOCK_ANNOUNCEMENT_DATA
    );

    await act(async () => {
      render(<AnnouncementThreadBody {...mockProps} />);
    });

    fireEvent.click(screen.getByText('UpdateAnnouncementButton'));

    expect(mockProps.updateAnnouncementHandler).toHaveBeenCalledWith(
      'threadId',
      []
    );
  });

  it('should ask the server for the selected status rather than filtering here', async () => {
    (listAnnouncements as jest.Mock).mockResolvedValueOnce({
      data: [{ ...baseAnnouncement, id: 'scheduled' }],
      paging: {},
    });

    await act(async () => {
      render(
        <AnnouncementThreadBody
          {...mockProps}
          statusFilter={AnnouncementStatus.Scheduled}
        />
      );
    });

    // Derived server-side from startTime/endTime, so a match on a later page is
    // never hidden by a page-local filter.
    expect(listAnnouncements).toHaveBeenCalledWith(
      expect.objectContaining({ status: AnnouncementStatus.Scheduled })
    );
    expect(screen.getByTestId('rendered-ids')).toHaveTextContent('scheduled');
  });

  it('should refetch when the selected status tab changes', async () => {
    (listAnnouncements as jest.Mock).mockResolvedValue({
      data: [],
      paging: {},
    });

    const { rerender } = render(
      <AnnouncementThreadBody
        {...mockProps}
        statusFilter={AnnouncementStatus.Active}
      />
    );

    await act(async () => {
      rerender(
        <AnnouncementThreadBody
          {...mockProps}
          statusFilter={AnnouncementStatus.Expired}
        />
      );
    });

    expect(listAnnouncements).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: AnnouncementStatus.Expired })
    );
  });
});
