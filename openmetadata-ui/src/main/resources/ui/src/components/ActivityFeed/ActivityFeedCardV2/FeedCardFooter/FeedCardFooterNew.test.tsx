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
import { MemoryRouter } from 'react-router-dom';
import {
  Conversation,
  ConversationSource,
} from '../../../../generated/entity/feed/conversation';
import FeedCardFooterNew from './FeedCardFooterNew';

const mockShowDrawer = jest.fn();

jest.mock('../../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: () => ({
    showDrawer: mockShowDrawer,
    updateReactions: jest.fn(),
  }),
}));

jest.mock('../../Reactions/Reactions', () => jest.fn(() => null));

const conversation: Conversation = {
  about: '<#E::table::service.table>',
  createdAt: 1,
  createdBy: { id: 'author-id', type: 'user', name: 'alice' },
  entityRef: { id: 'table-id', type: 'table', name: 'table' },
  id: 'conversation-1',
  message: 'Root',
  replyCount: 0,
  resolved: false,
  source: ConversationSource.User,
  updatedAt: 1,
};

describe('FeedCardFooterNew', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the conversation in the thread drawer from Reply by default', () => {
    render(
      <MemoryRouter>
        <FeedCardFooterNew
          isForFeedTab
          conversation={conversation}
          conversationId={conversation.id}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('reply-button'));

    expect(mockShowDrawer).toHaveBeenCalledWith(conversation);
  });

  it('hands Reply to the caller instead when it asks to', () => {
    const onReplyPress = jest.fn();

    render(
      <MemoryRouter>
        <FeedCardFooterNew
          isForFeedTab
          conversation={conversation}
          conversationId={conversation.id}
          onReplyPress={onReplyPress}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('reply-button'));

    expect(onReplyPress).toHaveBeenCalledTimes(1);
    expect(mockShowDrawer).not.toHaveBeenCalled();
  });

  it.each([
    [0, 'label.reply'],
    [1, 'label.one-reply'],
    [3, 'label.number-reply-plural'],
  ])(
    'names %i replies on the reply button in place of the repliers',
    (replyCount, label) => {
      render(
        <MemoryRouter>
          <FeedCardFooterNew
            showReplyCount
            conversation={{
              ...conversation,
              replyCount,
              replies: [
                {
                  author: { id: 'bob-id', type: 'user', name: 'bob' },
                  conversationId: conversation.id,
                  createdAt: 2,
                  id: 'reply-1',
                  message: 'Reply',
                  updatedAt: 2,
                },
              ],
            }}
            conversationId={conversation.id}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('reply-button')).toHaveTextContent(label);
      expect(screen.queryByTestId('profile-avatar')).not.toBeInTheDocument();
    }
  );
});
