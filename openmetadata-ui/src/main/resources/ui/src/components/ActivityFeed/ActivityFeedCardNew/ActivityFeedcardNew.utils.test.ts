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
import { Conversation } from '../../../generated/entity/feed/conversation';
import { canManageConversation } from './ActivityFeedcardNew.utils';

const conversation = {
  id: 'conversation-1',
  createdBy: { id: 'author-id', type: 'user', name: 'alice' },
} as Conversation;

const author = { id: 'author-id', name: 'alice' };
const other = { id: 'other-id', name: 'bob' };

describe('canManageConversation', () => {
  it('lets the author manage their root conversation', () => {
    expect(canManageConversation(author, conversation, true)).toBe(true);
  });

  it('lets an admin manage another users conversation', () => {
    expect(
      canManageConversation({ ...other, isAdmin: true }, conversation, true)
    ).toBe(true);
  });

  it('denies another non-admin user', () => {
    expect(canManageConversation(other, conversation, true)).toBe(false);
  });

  it('denies a post that is not the root conversation', () => {
    expect(canManageConversation(author, conversation, false)).toBe(false);
  });

  it('denies when there is no conversation', () => {
    expect(
      canManageConversation({ ...author, isAdmin: true }, undefined, true)
    ).toBe(false);
  });
});
