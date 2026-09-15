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

import { Operation } from 'fast-json-patch';
import { ReactionType } from '../generated/type/reaction';
import {
  addConversationReaction,
  addConversationReplyReaction,
  createConversation,
  createConversationReply,
  deleteConversation,
  deleteConversationReply,
  getConversation,
  listConversationReplies,
  listConversations,
  patchConversation,
  patchConversationReply,
  removeConversationReaction,
  removeConversationReplyReaction,
} from './conversationsAPI';
import APIClient from './index';

jest.mock('./index', () => ({
  delete: jest.fn(),
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

const response = { data: { id: 'conversation-1' } };

describe('conversationsAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (APIClient.delete as jest.Mock).mockResolvedValue(response);
    (APIClient.get as jest.Mock).mockResolvedValue(response);
    (APIClient.patch as jest.Mock).mockResolvedValue(response);
    (APIClient.post as jest.Mock).mockResolvedValue(response);
    (APIClient.put as jest.Mock).mockResolvedValue(response);
  });

  it('lists conversations with filters and cursors', async () => {
    const params = { entityLink: '<#E::table::service.table>', after: 'next' };

    await listConversations(params);

    expect(APIClient.get).toHaveBeenCalledWith('/conversations', { params });
  });

  it('creates a conversation', async () => {
    const request = { about: '<#E::table::service.table>', message: 'Root' };

    await createConversation(request);

    expect(APIClient.post).toHaveBeenCalledWith('/conversations', request);
  });

  it('gets a conversation', async () => {
    await getConversation('conversation-1');

    expect(APIClient.get).toHaveBeenCalledWith('/conversations/conversation-1');
  });

  it('patches a conversation', async () => {
    const patch: Operation[] = [
      { op: 'replace', path: '/message', value: 'Updated' },
    ];

    await patchConversation('conversation-1', patch);

    expect(APIClient.patch).toHaveBeenCalledWith(
      '/conversations/conversation-1',
      patch
    );
  });

  it('deletes a conversation', async () => {
    await deleteConversation('conversation-1');

    expect(APIClient.delete).toHaveBeenCalledWith(
      '/conversations/conversation-1'
    );
  });

  it('adds and removes a root reaction', async () => {
    await addConversationReaction('conversation-1', ReactionType.Heart);
    await removeConversationReaction('conversation-1', ReactionType.Heart);

    const path = '/conversations/conversation-1/reaction/heart';

    expect(APIClient.put).toHaveBeenCalledWith(path);
    expect(APIClient.delete).toHaveBeenCalledWith(path);
  });

  it('lists replies with an independent cursor', async () => {
    const params = { before: 'previous', limit: 50 };

    await listConversationReplies('conversation-1', params);

    expect(APIClient.get).toHaveBeenCalledWith(
      '/conversations/conversation-1/replies',
      { params }
    );
  });

  it('creates a reply', async () => {
    const request = { message: 'Reply' };

    await createConversationReply('conversation-1', request);

    expect(APIClient.post).toHaveBeenCalledWith(
      '/conversations/conversation-1/replies',
      request
    );
  });

  it('patches and deletes a reply', async () => {
    const patch: Operation[] = [
      { op: 'replace', path: '/message', value: 'Updated' },
    ];
    const path = '/conversations/conversation-1/replies/reply-1';

    await patchConversationReply('conversation-1', 'reply-1', patch);
    await deleteConversationReply('conversation-1', 'reply-1');

    expect(APIClient.patch).toHaveBeenCalledWith(path, patch);
    expect(APIClient.delete).toHaveBeenCalledWith(path);
  });

  it('adds and removes a reply reaction', async () => {
    await addConversationReplyReaction(
      'conversation-1',
      'reply-1',
      ReactionType.Rocket
    );
    await removeConversationReplyReaction(
      'conversation-1',
      'reply-1',
      ReactionType.Rocket
    );

    const path =
      '/conversations/conversation-1/replies/reply-1/reaction/rocket';

    expect(APIClient.put).toHaveBeenCalledWith(path);
    expect(APIClient.delete).toHaveBeenCalledWith(path);
  });
});
