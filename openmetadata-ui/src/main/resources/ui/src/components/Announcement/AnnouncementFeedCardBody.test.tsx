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
import { ReactionOperation } from '../../enums/reactions.enum';
import { Thread } from '../../generated/entity/feed/thread';
import { ReactionType } from '../../generated/type/reaction';
import { MOCK_ANNOUNCEMENT_DATA } from '../../mocks/Announcement.mock';
import { mockUserData } from '../../mocks/MyDataPage.mock';
import AnnouncementFeedCardBody from './AnnouncementFeedCardBody.component';

jest.mock('../../utils/FeedUtils', () => ({
  getEntityField: jest.fn(),
  getEntityFQN: jest.fn(),
  getEntityType: jest.fn(),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
  })),
}));

jest.mock('../ActivityFeed/ActivityFeedCard/FeedCardBody/FeedCardBody', () =>
  jest.fn().mockImplementation(({ onPostUpdate, onReactionSelect }) => (
    <>
      <p>FeedCardBody</p>
      <button onClick={() => onPostUpdate('message')}>PostUpdateButton</button>
      <button
        onClick={() =>
          onReactionSelect(ReactionType.Confused, ReactionOperation.ADD)
        }>
        ReactionSelectButton
      </button>
    </>
  ))
);

jest.mock(
  '../ActivityFeed/ActivityFeedCard/FeedCardHeader/FeedCardHeader',
  () => {
    return jest.fn().mockReturnValue(<p>FeedCardHeader</p>);
  }
);

jest.mock('../common/PopOverCard/UserPopOverCard', () => {
  return jest.fn().mockImplementation(() => <p>UserPopOverCard</p>);
});
jest.mock('../common/ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockImplementation(() => <p>ProfilePicture</p>);
});

jest.mock('../Modals/AnnouncementModal/EditAnnouncementModal', () => {
  return jest.fn().mockImplementation(() => <p>EditAnnouncementModal</p>);
});

jest.mock('../ActivityFeed/ActivityFeedCard/PopoverContent', () => {
  return jest.fn().mockImplementation(() => <p>PopoverContent</p>);
});

const mockFeedCardProps = {
  feed: {
    from: 'admin',
    id: '36ea94c9-7f12-489c-94df-56cbefe14b2f',
    message: 'Cypress announcement',
    postTs: 1714026576902,
    reactions: [],
  },
  task: MOCK_ANNOUNCEMENT_DATA.data[0],
  entityLink:
    '<#E::database::cy-database-service-373851.cypress-database-1714026557974>',
  isThread: true,
  editPermission: true,
  isReplyThreadOpen: false,
  updateThreadHandler: jest.fn(),
  onReply: jest.fn(),
  onConfirmation: jest.fn(),
  showReplyThread: jest.fn(),
};

describe('Test AnnouncementFeedCardBody Component', () => {
  it('Check if AnnouncementFeedCardBody component has all child components', async () => {
    render(<AnnouncementFeedCardBody {...mockFeedCardProps} />);
    const feedCardHeader = screen.getByText('FeedCardHeader');
    const feedCardBody = screen.getByText('FeedCardBody');
    const profilePictures = screen.getAllByText('ProfilePicture');
    const userPopOverCard = screen.getByText('UserPopOverCard');

    expect(feedCardHeader).toBeInTheDocument();
    expect(feedCardBody).toBeInTheDocument();
    expect(userPopOverCard).toBeInTheDocument();
    expect(profilePictures).toHaveLength(4);
  });

  it('should trigger onPostUpdate  from FeedCardBody', async () => {
    render(<AnnouncementFeedCardBody {...mockFeedCardProps} />);

    const postUpdateButton = screen.getByText('PostUpdateButton');

    fireEvent.click(postUpdateButton);

    expect(mockFeedCardProps.updateThreadHandler).toHaveBeenCalledWith(
      MOCK_ANNOUNCEMENT_DATA.data[0].id,
      MOCK_ANNOUNCEMENT_DATA.data[0].id,
      true,
      [{ op: 'replace', path: '/message', value: 'message' }]
    );
  });

  it('should trigger ReactionSelectButton from FeedCardBody', async () => {
    render(<AnnouncementFeedCardBody {...mockFeedCardProps} />);

    const reactionSelectButton = screen.getByText('ReactionSelectButton');

    fireEvent.click(reactionSelectButton);

    expect(mockFeedCardProps.updateThreadHandler).toHaveBeenCalledWith(
      MOCK_ANNOUNCEMENT_DATA.data[0].id,
      MOCK_ANNOUNCEMENT_DATA.data[0].id,
      true,
      [
        {
          op: 'add',
          path: '/reactions/0',
          value: {
            reactionType: 'confused',
            user: {
              id: '123',
            },
          },
        },
      ]
    );
  });

  it('should trigger postReplies button', async () => {
    render(<AnnouncementFeedCardBody {...mockFeedCardProps} />);

    const showReplyThread = screen.getByTestId('show-reply-thread');

    fireEvent.click(showReplyThread);

    expect(mockFeedCardProps.showReplyThread).toHaveBeenCalled();
  });

  it('should not render PostReplies Profile Picture if showRepliesButton is false', async () => {
    render(
      <AnnouncementFeedCardBody
        {...mockFeedCardProps}
        showRepliesButton={false}
      />
    );

    const profilePictures = screen.queryByText('ProfilePicture');
    const showReplyThread = screen.queryByTestId('show-reply-thread');

    expect(profilePictures).not.toBeInTheDocument();
    expect(showReplyThread).not.toBeInTheDocument();
  });

  it('should not render PostReplies button if repliesPost is empty', async () => {
    render(
      <AnnouncementFeedCardBody {...mockFeedCardProps} task={{} as Thread} />
    );

    const showReplyThread = screen.queryByTestId('show-reply-thread');

    expect(showReplyThread).not.toBeInTheDocument();
  });
});
