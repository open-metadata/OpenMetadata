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

import { isEmpty } from 'lodash';
import { EntityFieldThreads } from 'Models';
import React from 'react';
import { getThreadField } from './FeedUtils';

export const getFieldThreadElement = (
  columnName: string,
  columnField: string,
  entityFieldThreads: EntityFieldThreads[],
  onThreadLinkSelect?: (value: string) => void
) => {
  let threadValue: EntityFieldThreads = {} as EntityFieldThreads;

  entityFieldThreads?.forEach((thread) => {
    const threadField = getThreadField(thread.entityField);
    if (threadField[0] === columnName && threadField[1] === columnField) {
      threadValue = thread;
    }
  });

  return !isEmpty(threadValue) ? (
    <p
      className="tw-text-right link-text"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onThreadLinkSelect?.(threadValue.entityLink);
      }}>
      <i className="far fa-comment" /> {threadValue.count} threads
    </p>
  ) : null;
};
