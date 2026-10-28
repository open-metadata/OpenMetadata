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
import {
  Conversation,
  ConversationSource,
} from '../../../generated/entity/feed/conversation';
import FeedPanelBodyV1New from './FeedPanelBodyV1New';

jest.mock('../ActivityFeedCardNew/ActivityFeedcardNew.component', () =>
  jest.fn(({ onReplyPress }) => (
    <div data-testid="card-content">
      <button data-testid="reply" onClick={onReplyPress}>
        Reply
      </button>
    </div>
  ))
);

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

describe('FeedPanelBodyV1New', () => {
  it('opens the conversation from a click anywhere on the card', () => {
    const onFeedClick = jest.fn();
    render(
      <FeedPanelBodyV1New feed={conversation} onFeedClick={onFeedClick} />
    );

    expect(screen.getByTestId('message-container')).toHaveAttribute(
      'role',
      'button'
    );

    fireEvent.click(screen.getByTestId('card-content'));

    expect(onFeedClick).toHaveBeenCalledWith(conversation);
  });

  it('opens the conversation only from Reply in the thread panel', () => {
    const onFeedClick = jest.fn();
    render(
      <FeedPanelBodyV1New
        isThreadPanel
        feed={conversation}
        onFeedClick={onFeedClick}
      />
    );

    expect(screen.getByTestId('message-container')).not.toHaveAttribute('role');

    fireEvent.click(screen.getByTestId('card-content'));

    expect(onFeedClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('reply'));

    expect(onFeedClick).toHaveBeenCalledWith(conversation);
  });
});
