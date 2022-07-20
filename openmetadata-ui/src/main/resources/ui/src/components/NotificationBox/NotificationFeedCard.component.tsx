/*
 *  Copyright 2022 Collate
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

import { toString } from 'lodash';
import React, { FC } from 'react';
import { Link } from 'react-router-dom';
import AppState from '../../AppState';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityType, FqnPart } from '../../enums/entity.enum';
import { ThreadType } from '../../generated/entity/feed/thread';
import {
  getPartialNameFromFQN,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import { prepareFeedLink } from '../../utils/FeedUtils';
import { getTaskDetailPath } from '../../utils/TasksUtils';
import { NotificationFeedProp } from './NotificationFeedCard.interface';

const NotificationFeedCard: FC<NotificationFeedProp> = ({
  createdBy,
  entityFQN,
  entityType,
  icon,
  feedType,
  taskDetails,
}) => {
  const entityDisplayName = () => {
    let displayName;
    if (entityType === EntityType.TABLE) {
      displayName = getPartialNameFromTableFQN(
        entityFQN,
        [FqnPart.Database, FqnPart.Schema, FqnPart.Table],
        '.'
      );
    } else if (entityType === EntityType.DATABASE_SCHEMA) {
      displayName = getPartialNameFromTableFQN(entityFQN, [FqnPart.Schema]);
    } else if (
      [
        EntityType.DATABASE_SERVICE,
        EntityType.DASHBOARD_SERVICE,
        EntityType.MESSAGING_SERVICE,
        EntityType.PIPELINE_SERVICE,
        EntityType.TYPE,
        EntityType.MLMODEL,
      ].includes(entityType as EntityType)
    ) {
      displayName = getPartialNameFromFQN(entityFQN, ['service']);
    } else if (
      [EntityType.GLOSSARY, EntityType.GLOSSARY_TERM].includes(
        entityType as EntityType
      )
    ) {
      displayName = entityFQN.split(FQN_SEPARATOR_CHAR).pop();
    } else {
      displayName = getPartialNameFromFQN(entityFQN, ['database']);
    }

    // Remove quotes if the name is wrapped in quotes
    if (displayName) {
      displayName = displayName.replace(/^"+|"+$/g, '');
    }

    return displayName;
  };

  return (
    <div className="tw-flex tw-leading-4 tw-items-start">
      {icon}
      <span>
        <span>{createdBy}</span>
        {feedType === ThreadType.Conversation ? (
          <span>
            <span> posted on </span> <span>{entityType} </span>
            <Link
              className="tw-truncate"
              to={prepareFeedLink(entityType, entityFQN)}>
              <button className="tw-text-info" disabled={AppState.isTourOpen}>
                <div>{entityDisplayName()}</div>
              </button>
            </Link>
          </span>
        ) : (
          <>
            <span className="tw-px-1">assigned you a new task</span>
            <Link to={getTaskDetailPath(toString(taskDetails?.id)).pathname}>
              <button className="tw-text-info" disabled={AppState.isTourOpen}>
                {`#${taskDetails?.id}`} <span>{taskDetails?.type}</span>
              </button>
            </Link>
          </>
        )}
      </span>
    </div>
  );
};

export default NotificationFeedCard;
