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

import { isEmpty, isUndefined } from 'lodash';
import { EntityFieldThreads } from 'Models';
import React, { Fragment } from 'react';
import { EntityReference } from '../generated/entity/teams/user';
import { getEntityFeedLink } from './EntityUtils';
import { getThreadField } from './FeedUtils';
import SVGIcons, { Icons } from './SvgUtils';

export const getFieldThreadElement = (
  columnName: string,
  columnField: string,
  entityFieldThreads: EntityFieldThreads[],
  onThreadLinkSelect?: (value: string) => void,
  entityType?: string,
  entityFqn?: string,
  entityField?: string
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
      className="tw-text-right link-text "
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onThreadLinkSelect?.(threadValue.entityLink);
      }}>
      <SVGIcons alt="comments" icon={Icons.COMMENT} width="20px" />{' '}
      {threadValue.count}
    </p>
  ) : (
    <Fragment>
      {entityType && entityFqn && entityField ? (
        <p
          className="tw-text-right link-text "
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onThreadLinkSelect?.(
              getEntityFeedLink(entityType, entityFqn, entityField)
            );
          }}>
          <SVGIcons alt="comments" icon={Icons.COMMENT} width="20px" />+
        </p>
      ) : null}
    </Fragment>
  );
};

export const getDefaultValue = (owner: EntityReference) => {
  const message = 'Can you add a description?';
  if (isUndefined(owner)) {
    return `${message}`;
  } else {
    const name = owner.name;
    const displayName = owner.displayName;
    const entityType = owner.type;
    const mention = `<a href=${`${document.location.protocol}//${document.location.host}/${entityType}/${name}`}>@${displayName}</a>`;

    return `${mention} ${message}`;
  }
};
