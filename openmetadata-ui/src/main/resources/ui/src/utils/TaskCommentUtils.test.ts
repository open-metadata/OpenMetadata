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

import { TaskComment } from '../generated/entity/tasks/task';
import { resolveCommentPermissions } from './TaskCommentUtils';

const comment = {
  id: 'c1',
  message: 'hello',
  createdAt: 0,
  author: { id: 'u1', type: 'user', name: 'alice' },
} as TaskComment;

describe('resolveCommentPermissions', () => {
  it('should let the author edit and delete their own comment', () => {
    expect(resolveCommentPermissions({ name: 'alice' }, comment)).toEqual({
      canEdit: true,
      canDelete: true,
      canModify: true,
    });
  });

  it('should let an admin delete but not edit someone elses comment', () => {
    expect(
      resolveCommentPermissions({ name: 'bob', isAdmin: true }, comment)
    ).toEqual({ canEdit: false, canDelete: true, canModify: true });
  });

  it('should give a non-author non-admin nothing', () => {
    expect(
      resolveCommentPermissions({ name: 'bob', isAdmin: false }, comment)
    ).toEqual({ canEdit: false, canDelete: false, canModify: false });
  });

  it('should give an unknown current user nothing', () => {
    expect(resolveCommentPermissions(undefined, comment)).toEqual({
      canEdit: false,
      canDelete: false,
      canModify: false,
    });
  });

  // Both sides being nameless must not read as "same person".
  it('should not treat a nameless user as the author of a nameless comment', () => {
    const anonymous = { ...comment, author: { id: 'u1', type: 'user' } };

    expect(resolveCommentPermissions({}, anonymous as TaskComment)).toEqual({
      canEdit: false,
      canDelete: false,
      canModify: false,
    });
  });
});
