/*
 *  Copyright 2022 Collate.
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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  Conversation,
  ConversationSource,
} from '../../../generated/entity/feed/conversation';
import {
  createConversation,
  listConversations,
} from '../../../rest/conversationsAPI';
import ActivityThreadPanelBody from './ActivityThreadPanelBody';

const conversation: Conversation = {
  about: '<#E::table::service.database.schema.table>',
  createdAt: 1,
  createdBy: { id: 'user-1', type: 'user', name: 'admin' },
  entityRef: { id: 'table-1', type: 'table', name: 'table' },
  id: 'conversation-1',
  message: 'Root message',
  replyCount: 0,
  resolved: false,
  source: ConversationSource.User,
  updatedAt: 1,
};

const refreshActivityFeed = jest.fn();
const setActiveThread = jest.fn();
let isObserverInView = false;
const providerValue = {
  entityPaging: {},
  entityThread: [conversation],
  getTaskData: jest.fn(),
  loading: false,
  refreshActivityFeed,
  selectedTask: undefined,
  selectedThread: undefined as Conversation | undefined,
  setActiveTask: jest.fn(),
  setActiveThread,
  tasks: [],
};

jest.mock('../../../rest/conversationsAPI', () => ({
  createConversation: jest.fn(),
  listConversations: jest.fn(),
}));

jest.mock('../../../hooks/useElementInView', () => ({
  useElementInView: () => [{ current: null }, isObserverInView],
}));

jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: jest.fn(() => providerValue),
}));

jest.mock('../ActivityFeedEditor/ActivityFeedEditor', () =>
  jest.fn(({ onSave }) => (
    <button data-testid="conversation-editor" onClick={() => onSave('Hello')}>
      Editor
    </button>
  ))
);

jest.mock('../ActivityFeedPanel/FeedPanelHeader', () =>
  jest.fn(() => <p>FeedPanelHeader</p>)
);

jest.mock('../ActivityFeedPanel/FeedPanelBodyV1New', () =>
  jest.fn(({ feed, onFeedClick }) => (
    <button
      data-testid={`conversation-${feed.id}`}
      onClick={() => onFeedClick(feed)}>
      {feed.message}
    </button>
  ))
);

jest.mock('../ActivityFeedCardNew/ActivityFeedcardNew.component', () =>
  jest.fn(({ feed }) => <p data-testid="selected-conversation">{feed.id}</p>)
);

describe('ActivityThreadPanelBody', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isObserverInView = false;
    providerValue.entityThread = [conversation];
    providerValue.selectedThread = undefined;
    (listConversations as jest.Mock).mockResolvedValue({
      data: [conversation],
      paging: {},
    });
  });

  it('lists and selects conversations using Conversation V2', async () => {
    render(
      <MemoryRouter>
        <ActivityThreadPanelBody
          threadLink={conversation.about}
          view="conversations"
        />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(listConversations).toHaveBeenCalledWith({
        after: undefined,
        entityLink: conversation.about,
      })
    );
    fireEvent.click(await screen.findByTestId('conversation-conversation-1'));

    expect(setActiveThread).toHaveBeenCalledWith(conversation);
    expect(screen.getByTestId('observer-element')).toBeInTheDocument();
  });

  it('loads the next conversation page with the keyset cursor', async () => {
    const nextConversation = {
      ...conversation,
      id: 'conversation-2',
      message: 'Next root message',
    };
    (listConversations as jest.Mock)
      .mockResolvedValueOnce({
        data: [conversation],
        paging: { after: 'next-conversation-cursor' },
      })
      .mockResolvedValueOnce({ data: [nextConversation], paging: {} });

    const { rerender } = render(
      <MemoryRouter>
        <ActivityThreadPanelBody
          threadLink={conversation.about}
          view="conversations"
        />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(refreshActivityFeed).toHaveBeenCalledWith([conversation])
    );

    isObserverInView = true;
    rerender(
      <MemoryRouter>
        <ActivityThreadPanelBody
          threadLink={conversation.about}
          view="conversations"
        />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(listConversations).toHaveBeenLastCalledWith({
        after: 'next-conversation-cursor',
        entityLink: conversation.about,
      })
    );

    expect(refreshActivityFeed).toHaveBeenLastCalledWith([
      conversation,
      nextConversation,
    ]);
  });

  it('creates a conversation and updates the bounded list', async () => {
    providerValue.entityThread = [];
    (listConversations as jest.Mock).mockResolvedValue({
      data: [],
      paging: {},
    });
    (createConversation as jest.Mock).mockResolvedValue(conversation);

    render(
      <MemoryRouter>
        <ActivityThreadPanelBody
          threadLink={conversation.about}
          view="conversations"
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByTestId('conversation-editor'));

    await waitFor(() =>
      expect(createConversation).toHaveBeenCalledWith({
        about: conversation.about,
        message: 'Hello',
      })
    );

    expect(refreshActivityFeed).toHaveBeenCalledWith([conversation]);
  });

  it('renders the selected conversation with its hydrated replies', async () => {
    providerValue.selectedThread = conversation;

    render(
      <MemoryRouter>
        <ActivityThreadPanelBody
          threadLink={conversation.about}
          view="conversations"
        />
      </MemoryRouter>
    );

    expect(
      await screen.findByTestId('selected-conversation')
    ).toHaveTextContent(conversation.id);
  });
});
