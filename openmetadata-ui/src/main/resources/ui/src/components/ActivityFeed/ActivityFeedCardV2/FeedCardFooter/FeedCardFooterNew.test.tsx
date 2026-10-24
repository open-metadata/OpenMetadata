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
import { fireEvent, render, screen } from '@testing-library/react';
import { Conversation } from '../../../../generated/entity/feed/conversation';
import FeedCardFooterNew from './FeedCardFooterNew';

const mockShowDrawer = jest.fn();

jest.mock('../../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: jest.fn().mockImplementation(() => ({
    showDrawer: mockShowDrawer,
    updateReactions: jest.fn(),
  })),
}));

jest.mock('../../../common/PopOverCard/UserPopOverCard', () =>
  jest.fn().mockImplementation(({ children }) => children)
);

jest.mock('../../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockImplementation(({ name }) => <span>{name}</span>)
);

jest.mock('../../Reactions/Reactions', () =>
  jest.fn().mockImplementation(() => <div data-testid="reactions" />)
);

const conversation = {
  id: 'conversation-1',
  replyCount: 2,
  replies: [
    { author: { name: 'alice' } },
    { author: { name: 'bob' } },
    { author: { name: 'alice' } },
  ],
} as unknown as Conversation;

describe('FeedCardFooterNew', () => {
  beforeEach(() => {
    mockShowDrawer.mockClear();
  });

  it('names each replier avatar button after the user it shows', () => {
    render(
      <FeedCardFooterNew
        conversation={conversation}
        conversationId="conversation-1"
      />
    );

    expect(
      screen.getAllByRole('button', { name: 'label.view-replies-by-user' })
    ).toHaveLength(2);
  });

  it('opens the replies from an avatar and lets the click reach the card', () => {
    const mockContainerClick = jest.fn();

    render(
      <div role="presentation" onClick={mockContainerClick}>
        <FeedCardFooterNew
          isForFeedTab
          conversation={conversation}
          conversationId="conversation-1"
        />
      </div>
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: 'label.view-replies-by-user' })[0]
    );

    expect(mockShowDrawer).toHaveBeenCalledWith(conversation);
    expect(mockContainerClick).toHaveBeenCalled();
  });

  it('opens the replies from the reply button', () => {
    render(
      <FeedCardFooterNew
        isForFeedTab
        conversation={conversation}
        conversationId="conversation-1"
      />
    );

    fireEvent.click(screen.getByTestId('reply-button'));

    expect(mockShowDrawer).toHaveBeenCalledWith(conversation);
  });

  it('hides the avatars and reply button on a reply', () => {
    render(
      <FeedCardFooterNew
        isReply
        conversation={conversation}
        conversationId="conversation-1"
      />
    );

    expect(screen.queryByTestId('reply-button')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'label.view-replies-by-user' })
    ).not.toBeInTheDocument();
  });
});
