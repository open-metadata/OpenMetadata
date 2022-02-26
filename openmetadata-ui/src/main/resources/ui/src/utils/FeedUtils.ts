/*
 *  Copyright 2021 Collate
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

import {
  EntityFieldThreadCount,
  EntityFieldThreads,
  EntityThread,
  EntityThreadField,
} from 'Models';
import TurndownService from 'turndown';
import { EntityRegEx } from '../constants/feed.constants';
import { getRelativeDateByTimeStamp } from './TimeUtils';

export const getEntityType = (entityLink: string) => {
  const match = EntityRegEx.exec(entityLink);

  return match?.[1];
};
export const getEntityFQN = (entityLink: string) => {
  const match = EntityRegEx.exec(entityLink);

  return match?.[2];
};
export const getEntityField = (entityLink: string) => {
  const match = EntityRegEx.exec(entityLink);

  return match?.[3];
};

export const getFeedListWithRelativeDays = (feedList: EntityThread[]) => {
  const updatedFeedList = feedList.map((feed) => ({
    ...feed,
    relativeDay: getRelativeDateByTimeStamp(feed.updatedAt),
  }));
  const relativeDays = [...new Set(updatedFeedList.map((f) => f.relativeDay))];

  return { updatedFeedList, relativeDays };
};

export const HTMLToMarkdown = new TurndownService({
  bulletListMarker: '-',
  fence: '```',
  codeBlockStyle: 'fenced',
})
  .addRule('codeblock', {
    filter: ['pre'],
    replacement: function (content: string) {
      return '```\n' + content + '\n```';
    },
  })
  .addRule('strikethrough', {
    filter: ['del', 's'],
    replacement: function (content: string) {
      return '~~' + content + '~~';
    },
  });

export const getReplyText = (count: number) => {
  if (count === 0) return 'Reply in thread';
  if (count === 1) return `${count} Reply`;

  return `${count} Replies`;
};

export const getEntityFieldThreadCounts = (
  field: EntityThreadField,
  entityFieldThreadCount: EntityFieldThreadCount[]
) => {
  const entityFieldThreads: EntityFieldThreads[] = [];

  entityFieldThreadCount.map((fieldCount) => {
    const entityField = getEntityField(fieldCount.entityLink);
    if (entityField?.startsWith(field)) {
      entityFieldThreads.push({
        entityLink: fieldCount.entityLink,
        count: fieldCount.count,
        entityField,
      });
    }
  });

  return entityFieldThreads;
};

export const getThreadField = (value: string, separator = '/') => {
  return value.split(separator).slice(-2);
};
