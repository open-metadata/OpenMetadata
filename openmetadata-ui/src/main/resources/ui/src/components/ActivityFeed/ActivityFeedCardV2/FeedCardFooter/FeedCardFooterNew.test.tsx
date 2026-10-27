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
import { MemoryRouter } from 'react-router-dom';
import { Conversation } from '../../../../generated/entity/feed/conversation';
import { mockUserData } from '../../../../mocks/MyDataPage.mock';
import ActivityFeedProvider from '../../ActivityFeedProvider/ActivityFeedProvider';
import FeedCardFooterNew from './FeedCardFooterNew';

// Only the boundaries are mocked: REST calls, the app stores, and the lazily
// loaded drawer, which shows the thread the real provider opened.
jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({ currentUser: mockUserData })),
}));

jest.mock('../../../../hooks/useDomainStore', () => ({
  useDomainStore: (selector: (state: { activeDomain: string }) => unknown) =>
    selector({ activeDomain: 'All Domains' }),
}));

jest.mock('../../ActivityFeedDrawer/ActivityFeedDrawer', () =>
  jest.fn().mockImplementation(() => {
    const { useActivityFeedProvider } = jest.requireActual(
      '../../ActivityFeedProvider/ActivityFeedProvider'
    );
    const { selectedThread } = useActivityFeedProvider();

    return <p data-testid="replies-drawer">{selectedThread?.message}</p>;
  })
);

jest.mock('../../../../rest/activityAPI', () => ({
  getActivityEvents: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  listActivityReplies: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
}));

jest.mock('../../../../rest/conversationsAPI', () => ({
  listConversationReplies: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
  listConversations: jest.fn().mockResolvedValue({ data: [], paging: {} }),
}));

jest.mock('../../../../rest/userAPI', () => ({
  getUserByName: jest.fn().mockResolvedValue({}),
}));

const conversation = {
  id: 'conversation-1',
  message: 'Footer conversation',
  replyCount: 2,
  replies: [
    { author: { name: 'alice' } },
    { author: { name: 'bob' } },
    { author: { name: 'alice' } },
  ],
} as unknown as Conversation;

const renderFooter = async (
  props: Partial<Parameters<typeof FeedCardFooterNew>[0]> = {},
  onCardClick = jest.fn()
) => {
  await act(async () => {
    render(
      <MemoryRouter>
        <ActivityFeedProvider>
          <div role="presentation" onClick={onCardClick}>
            <FeedCardFooterNew
              conversation={conversation}
              conversationId="conversation-1"
              {...props}
            />
          </div>
        </ActivityFeedProvider>
      </MemoryRouter>
    );
  });
};

describe('FeedCardFooterNew', () => {
  it('names each replier avatar button after the user it shows', async () => {
    await renderFooter();

    expect(
      screen.getAllByRole('button', { name: 'label.view-replies-by-user' })
    ).toHaveLength(2);
  });

  it('opens the replies from an avatar and lets the click reach the card', async () => {
    const onCardClick = jest.fn();
    await renderFooter({ isForFeedTab: true }, onCardClick);

    expect(screen.queryByTestId('replies-drawer')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'label.view-replies-by-user' })[0]
    );

    expect(await screen.findByTestId('replies-drawer')).toHaveTextContent(
      'Footer conversation'
    );
    expect(onCardClick).toHaveBeenCalled();
  });

  it('opens the replies from the reply button', async () => {
    await renderFooter({ isForFeedTab: true });

    fireEvent.click(screen.getByRole('button', { name: 'label.reply' }));

    expect(await screen.findByTestId('replies-drawer')).toHaveTextContent(
      'Footer conversation'
    );
  });

  it('hides the avatars and reply button on a reply', async () => {
    await renderFooter({ isReply: true });

    expect(
      screen.queryByRole('button', { name: 'label.reply' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'label.view-replies-by-user' })
    ).not.toBeInTheDocument();
  });

  describe('in an activity thread panel', () => {
    it('hands Reply to the caller instead of opening the drawer', async () => {
      const onReplyPress = jest.fn();
      await renderFooter({ isForFeedTab: true, onReplyPress });

      fireEvent.click(screen.getByTestId('reply-button'));

      expect(onReplyPress).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('replies-drawer')).not.toBeInTheDocument();
    });

    it.each([
      [0, 'label.reply'],
      [1, 'label.one-reply'],
      [3, 'label.number-reply-plural'],
    ])(
      'labels %i replies on the reply button and drops the replier avatars',
      async (replyCount, label) => {
        await renderFooter({
          showReplyCount: true,
          conversation: { ...conversation, replyCount },
        });

        expect(screen.getByTestId('reply-button')).toHaveTextContent(label);
        expect(
          screen.queryByRole('button', { name: 'label.view-replies-by-user' })
        ).not.toBeInTheDocument();
      }
    );

    it('drops the reply button where the conversation is already open', async () => {
      await renderFooter({
        showReplyCount: true,
        componentsVisibility: { showThreadIcon: false },
      });

      expect(screen.queryByTestId('reply-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('feed-reaction-container')).toBeInTheDocument();
    });
  });
});
