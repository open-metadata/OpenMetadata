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

export interface CommentPermissions {
  canDelete: boolean;
  canEdit: boolean;
  canModify: boolean;
}

/**
 * Who may act on a task comment. Mirrors the server's rules in
 * TaskRepository#editComment / #deleteComment: the author may edit or delete
 * their own comment, and an admin may additionally delete anyone's.
 *
 * Shared so the activity-feed card and the Inbox task panel cannot drift apart
 * from each other, or from the backend.
 */
export const resolveCommentPermissions = (
  currentUser: { name?: string; isAdmin?: boolean } | undefined,
  comment: TaskComment
): CommentPermissions => {
  const isAuthor =
    Boolean(currentUser?.name) && comment.author?.name === currentUser?.name;
  const canEdit = isAuthor;
  const canDelete = isAuthor || Boolean(currentUser?.isAdmin);

  return { canEdit, canDelete, canModify: canEdit || canDelete };
};
