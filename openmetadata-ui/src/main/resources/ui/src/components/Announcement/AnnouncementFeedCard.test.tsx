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
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  MOCK_ANNOUNCEMENT_DATA,
  MOCK_ANNOUNCEMENT_FEED_DATA,
} from '../../mocks/Announcement.mock';
import { getFeedById } from '../../rest/feedsAPI';
import AnnouncementFeedCard from './AnnouncementFeedCard.component';

jest.mock('../../rest/feedsAPI', () => ({
  getFeedById: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('./AnnouncementFeedCardBody.component', () =>
  jest
    .fn()
    .mockImplementation(
      ({ showReplyThread, updateThreadHandler, onConfirmation, onReply }) => (
        <>
          <p>AnnouncementFeedCardBody</p>
          <button onClick={showReplyThread}>ShowReplyThreadButton</button>
          <button
            onClick={() =>
              updateThreadHandler('threadId', 'postId', true, 'data')
            }>
            UpdateThreadHandlerButton
          </button>
          <button onClick={onConfirmation}>ConfirmationButton</button>
          <button onClick={onReply}>ReplyButton</button>
        </>
      )
    )
);

jest.mock('../ActivityFeed/ActivityFeedEditor/ActivityFeedEditor', () => {
  return jest.fn().mockImplementation(({ onSave }) => (
    <>
      <p>ActivityFeedEditor</p>
      <button onClick={() => onSave('changesValue')}>onSaveReply</button>
    </>
  ));
});

jest.mock('../ActivityFeed/Shared/AnnouncementBadge', () => {
  return jest.fn().mockReturnValue(<p>AnnouncementBadge</p>);
});

jest.mock('../common/ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockReturnValue(<p>ProfilePicture</p>);
});

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockProps = {
  feed: {
    message: 'Cypress announcement',
    postTs: 1714026576902,
    from: 'admin',
    id: '36ea94c9-7f12-489c-94df-56cbefe14b2f',
    reactions: [],
  },
  task: MOCK_ANNOUNCEMENT_DATA.data[0],
  editPermission: true,
  postFeed: jest.fn(),
  onConfirmation: jest.fn(),
  updateThreadHandler: jest.fn(),
};

describe('Test AnnouncementFeedCard Component', () => {
  it('should render AnnouncementFeedCard component', () => {
    render(<AnnouncementFeedCard {...mockProps} />);

    expect(screen.getByText('AnnouncementBadge')).toBeInTheDocument();
    expect(screen.getByText('AnnouncementFeedCardBody')).toBeInTheDocument();
  });

  it('should trigger onConfirmation', () => {
    render(<AnnouncementFeedCard {...mockProps} />);

    fireEvent.click(screen.getByText('ConfirmationButton'));

    expect(mockProps.onConfirmation).toHaveBeenCalled();
  });

  it('should trigger updateThreadHandler without fetchAnnouncementThreadData when replyThread is closed', () => {
    render(<AnnouncementFeedCard {...mockProps} />);

    fireEvent.click(screen.getByText('UpdateThreadHandlerButton'));

    expect(mockProps.updateThreadHandler).toHaveBeenCalledWith(
      'threadId',
      'postId',
      true,
      'data'
    );
    expect(getFeedById).not.toHaveBeenCalled();
  });

  it('should trigger updateThreadHandler with fetchAnnouncementThreadData when replyThread is open', () => {
    render(<AnnouncementFeedCard {...mockProps} />);

    act(() => {
      fireEvent.click(screen.getByText('ShowReplyThreadButton'));
    });

    expect(getFeedById).toHaveBeenCalledWith(MOCK_ANNOUNCEMENT_DATA.data[0].id);

    fireEvent.click(screen.getByText('UpdateThreadHandlerButton'));

    expect(mockProps.updateThreadHandler).toHaveBeenCalledWith(
      'threadId',
      'postId',
      true,
      'data'
    );
    expect(getFeedById).toHaveBeenCalledWith(MOCK_ANNOUNCEMENT_DATA.data[0].id);
  });

  it('should trigger onReply with fetchAnnouncementThreadData', async () => {
    (getFeedById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: MOCK_ANNOUNCEMENT_FEED_DATA })
    );

    await act(async () => {
      render(<AnnouncementFeedCard {...mockProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('ReplyButton'));
    });

    expect(getFeedById).toHaveBeenCalledWith(MOCK_ANNOUNCEMENT_DATA.data[0].id);

    expect(screen.getByTestId('replies')).toBeInTheDocument();

    expect(screen.getAllByText('AnnouncementFeedCardBody')).toHaveLength(5);

    expect(screen.getByText('ProfilePicture')).toBeInTheDocument();

    expect(screen.getByText('ActivityFeedEditor')).toBeInTheDocument();

    fireEvent.click(screen.getByText('onSaveReply'));

    expect(mockProps.postFeed).toHaveBeenCalledWith(
      'changesValue',
      '36ea94c9-7f12-489c-94df-56cbefe14b2f'
    );

    expect(getFeedById).toHaveBeenCalledWith(MOCK_ANNOUNCEMENT_DATA.data[0].id);
  });
});
