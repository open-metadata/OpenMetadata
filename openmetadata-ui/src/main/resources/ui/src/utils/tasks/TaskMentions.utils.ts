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

import { entityLinkRegEx } from '../../constants/Feeds.constants';
import { listTasks, Task, TaskComment } from '../../rest/tasksAPI';
import Fqn from '../Fqn';

const TASK_MENTION_PAGE_SIZE = 100;

export interface TaskCommentMention {
  task: Pick<Task, 'id' | 'name' | 'about' | 'type'>;
  comment: TaskComment;
}

interface TaskCommentMentionOptions {
  domain?: string;
  startTs?: number;
  endTs?: number;
}

const mentionsUser = (message: string, name: string, quotedName: string) => {
  for (const [, type, target] of message.matchAll(entityLinkRegEx)) {
    const fqn = target.split('|', 1)[0];
    if (type === 'user' && (fqn === name || fqn === quotedName)) {
      return true;
    }
  }

  return false;
};

export const getTaskCommentMentions = async (
  mentionedUser: string,
  { domain, startTs = 0, endTs = Infinity }: TaskCommentMentionOptions = {}
) => {
  const name = Fqn.unquoteName(mentionedUser);
  const quotedName = Fqn.quoteName(name);
  const mentions: TaskCommentMention[] = [];
  let after: string | undefined;

  // Task pages are ordered by creation time. An old task can have a new mention.
  do {
    const { data, paging } = await listTasks({
      mentionedUser,
      domain,
      fields: 'about,comments',
      limit: TASK_MENTION_PAGE_SIZE,
      after,
    });
    for (const { id, name: taskName, about, type, comments } of data) {
      const task = { id, name: taskName, about, type };
      for (const comment of comments ?? []) {
        if (
          comment.createdAt >= startTs &&
          comment.createdAt <= endTs &&
          mentionsUser(comment.message, name, quotedName)
        ) {
          mentions.push({ task, comment });
        }
      }
    }
    after = paging?.after;
  } while (after);

  return mentions;
};
