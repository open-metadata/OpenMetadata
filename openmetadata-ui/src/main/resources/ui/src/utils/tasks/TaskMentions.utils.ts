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

const TASK_MENTION_LIMIT = 100;

export interface TaskCommentMention {
  task: Task;
  comment: TaskComment;
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
  domain?: string
) => {
  const { data, paging } = await listTasks({
    mentionedUser,
    domain,
    fields: 'about,comments',
    limit: TASK_MENTION_LIMIT,
  });
  const name = Fqn.unquoteName(mentionedUser);
  const quotedName = Fqn.quoteName(name);
  const mentions = data.flatMap((task) =>
    (task.comments ?? [])
      .filter(({ message }) => mentionsUser(message, name, quotedName))
      .map((comment) => ({ task, comment }))
  );

  return { mentions, isCapped: Boolean(paging?.after) };
};
