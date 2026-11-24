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
  task: Pick<Task, 'id' | 'name' | 'about' | 'type' | 'taskId'>;
  comment: TaskComment;
}

interface TaskCommentMentionOptions {
  domain?: string;
  startTs?: number;
  endTs?: number;
  maxResults?: number;
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

const trimToNewestMentions = (
  mentions: TaskCommentMention[],
  maxResults: number,
  oldestTaskUpdate?: number
) => {
  if (mentions.length < maxResults) {
    return false;
  }

  mentions.sort(
    (left, right) => right.comment.createdAt - left.comment.createdAt
  );
  mentions.splice(maxResults);

  // Adding a comment advances updatedAt, which bounds the timestamps on older pages.
  const oldestMention = mentions.at(-1);

  return (
    oldestTaskUpdate !== undefined &&
    oldestMention !== undefined &&
    oldestTaskUpdate < oldestMention.comment.createdAt
  );
};

export const getTaskCommentMentions = async (
  mentionedUser: string,
  {
    domain,
    startTs,
    endTs = Infinity,
    maxResults = Infinity,
  }: TaskCommentMentionOptions = {}
) => {
  if (maxResults < 1) {
    return [];
  }

  const name = Fqn.unquoteName(mentionedUser);
  const quotedName = Fqn.quoteName(name);
  const includesComment = ({ createdAt, message }: TaskComment) =>
    createdAt >= (startTs ?? 0) &&
    createdAt <= endTs &&
    mentionsUser(message, name, quotedName);
  const mentions: TaskCommentMention[] = [];
  let after: string | undefined;

  do {
    const { data, paging } = await listTasks({
      mentionedUser,
      domain,
      fields: 'about,comments',
      updatedSince: startTs,
      sortBy: 'updatedAt',
      limit: TASK_MENTION_PAGE_SIZE,
      after,
    });
    for (const { id, name: taskName, about, type, taskId, comments } of data) {
      const task = { id, name: taskName, about, type, taskId };
      comments
        ?.filter(includesComment)
        .forEach((comment) => mentions.push({ task, comment }));
    }
    if (trimToNewestMentions(mentions, maxResults, data.at(-1)?.updatedAt)) {
      break;
    }
    // Permission filtering can empty a page without exhausting its cursor.
    after = paging?.after;
  } while (after);

  return mentions;
};
