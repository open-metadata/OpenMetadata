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
import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react-test-renderer';
import { MOCK_ANNOUNCEMENT_DATA } from '../../mocks/Announcement.mock';
import { getAllFeeds } from '../../rest/feedsAPI';
import AnnouncementThreadBody from './AnnouncementThreadBody.component';

jest.mock('../../rest/feedsAPI', () => ({
  getAllFeeds: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('./AnnouncementThreads', () =>
  jest
    .fn()
    .mockImplementation(({ postFeed, updateThreadHandler, onConfirmation }) => (
      <>
        <p>AnnouncementThreads</p>
        <button onClick={() => postFeed('valueId', 'id')}>
          PostFeedButton
        </button>
        <button
          onClick={() =>
            onConfirmation({
              state: true,
              threadId: 'threadId',
              postId: 'postId',
              isThread: false,
            })
          }>
          ConfirmationButton
        </button>
        <button
          onClick={() =>
            updateThreadHandler('threadId', 'postId', true, {
              op: 'replace',
              path: '/announcement/description',
              value: 'Cypress announcement description.',
            })
          }>
          UpdateThreadButton
        </button>
      </>
    ))
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

jest.mock('../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest.fn().mockReturnValue(<p>ErrorPlaceHolder</p>);
});

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockProps = {
  threadLink: 'threadLink',
  refetchThread: false,
  editPermission: true,
  postFeedHandler: jest.fn(),
  deletePostHandler: jest.fn(),
  updateThreadHandler: jest.fn(),
};

describe('Test AnnouncementThreadBody Component', () => {
  it('should call getAllFeeds when component is mount', async () => {
    render(<AnnouncementThreadBody {...mockProps} />);

    expect(getAllFeeds).toHaveBeenCalledWith(
      'threadLink',
      undefined,
      'Announcement',
      'ALL'
    );
  });

  it('should render empty placeholder when data is not there', async () => {
    await act(async () => {
      render(<AnnouncementThreadBody {...mockProps} />);
    });

    const emptyPlaceholder = screen.getByText('ErrorPlaceHolder');

    expect(emptyPlaceholder).toBeInTheDocument();
  });

  it('Check if all child elements rendered', async () => {
    (getAllFeeds as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(MOCK_ANNOUNCEMENT_DATA)
    );

    await act(async () => {
      render(<AnnouncementThreadBody {...mockProps} />);
    });

    const component = screen.getByTestId('announcement-thread-body');
    const announcementThreads = screen.getByText('AnnouncementThreads');
    const confirmationModal = screen.getByText('Confirmation Modal is close');

    expect(component).toBeInTheDocument();
    expect(confirmationModal).toBeInTheDocument();
    expect(announcementThreads).toBeInTheDocument();
  });

  // Confirmation Modal

  it('should open delete confirmation modal', async () => {
    (getAllFeeds as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(MOCK_ANNOUNCEMENT_DATA)
    );

    await act(async () => {
      render(<AnnouncementThreadBody {...mockProps} />);
    });

    const confirmationCloseModal = screen.getByText(
      'Confirmation Modal is close'
    );

    expect(confirmationCloseModal).toBeInTheDocument();

    const confirmationButton = screen.getByText('ConfirmationButton');
    act(() => {
      fireEvent.click(confirmationButton);
    });
    const confirmationOpenModal = screen.getByText(
      'Confirmation Modal is open'
    );

    expect(confirmationOpenModal).toBeInTheDocument();
  });

  it('should trigger onConfirm in confirmation modal', async () => {
    (getAllFeeds as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(MOCK_ANNOUNCEMENT_DATA)
    );

    await act(async () => {
      render(<AnnouncementThreadBody {...mockProps} />);
    });

    const confirmationButton = screen.getByText('ConfirmationButton');
    act(() => {
      fireEvent.click(confirmationButton);
    });

    expect(screen.getByText('Confirmation Modal is open')).toBeInTheDocument();

    const confirmConfirmationButton = screen.getByText(
      'Confirm Confirmation Modal'
    );

    act(() => {
      fireEvent.click(confirmConfirmationButton);
    });

    expect(mockProps.deletePostHandler).toHaveBeenCalledWith(
      'threadId',
      'postId',
      false
    );

    expect(getAllFeeds).toHaveBeenCalledWith(
      'threadLink',
      undefined,
      'Announcement',
      'ALL'
    );
  });

  it('should trigger onCancel in confirmation modal', async () => {
    (getAllFeeds as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(MOCK_ANNOUNCEMENT_DATA)
    );

    await act(async () => {
      render(<AnnouncementThreadBody {...mockProps} />);
    });

    const confirmationButton = screen.getByText('ConfirmationButton');
    act(() => {
      fireEvent.click(confirmationButton);
    });

    expect(screen.getByText('Confirmation Modal is open')).toBeInTheDocument();

    const cancelConfirmationButton = screen.getByText(
      'Cancel Confirmation Modal'
    );

    act(() => {
      fireEvent.click(cancelConfirmationButton);
    });

    expect(screen.getByText('Confirmation Modal is close')).toBeInTheDocument();
  });

  // AnnouncementThreads Component

  it('should trigger postFeedHandler', async () => {
    (getAllFeeds as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(MOCK_ANNOUNCEMENT_DATA)
    );

    await act(async () => {
      render(<AnnouncementThreadBody {...mockProps} />);
    });

    const postFeedButton = screen.getByText('PostFeedButton');
    act(() => {
      fireEvent.click(postFeedButton);
    });

    expect(mockProps.postFeedHandler).toHaveBeenCalledWith('valueId', 'id');

    expect(getAllFeeds).toHaveBeenCalledWith(
      'threadLink',
      undefined,
      'Announcement',
      'ALL'
    );
  });

  it('should trigger updateThreadHandler', async () => {
    (getAllFeeds as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(MOCK_ANNOUNCEMENT_DATA)
    );

    await act(async () => {
      render(<AnnouncementThreadBody {...mockProps} />);
    });

    const postFeedButton = screen.getByText('UpdateThreadButton');
    act(() => {
      fireEvent.click(postFeedButton);
    });

    expect(mockProps.updateThreadHandler).toHaveBeenCalledWith(
      'threadId',
      'postId',
      true,
      {
        op: 'replace',
        path: '/announcement/description',
        value: 'Cypress announcement description.',
      }
    );

    expect(getAllFeeds).toHaveBeenCalledWith(
      'threadLink',
      undefined,
      'Announcement',
      'ALL'
    );
  });
});
