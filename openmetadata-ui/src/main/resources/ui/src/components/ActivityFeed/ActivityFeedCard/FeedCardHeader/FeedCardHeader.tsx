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

import classNames from 'classnames';
import { isUndefined, toString } from 'lodash';
import React, { FC } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { getUserPath } from '../../../../constants/constants';
import { ThreadType } from '../../../../generated/entity/feed/thread';
import {
  entityDisplayName,
  getEntityFieldDisplay,
  prepareFeedLink,
} from '../../../../utils/FeedUtils';
import { getTaskDetailPath } from '../../../../utils/TasksUtils';
import { getDayTimeByTimeStamp } from '../../../../utils/TimeUtils';
import EntityPopOverCard from '../../../common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from '../../../common/PopOverCard/UserPopOverCard';
import { FeedHeaderProp } from '../ActivityFeedCard.interface';
import './FeedCardHeader.style.css';

const FeedCardHeader: FC<FeedHeaderProp> = ({
  className,
  createdBy,
  timeStamp,
  entityFQN,
  entityType,
  entityField,
  isEntityFeed,
  feedType,
  taskDetails,
}) => {
  const history = useHistory();
  const onTitleClickHandler = (name: string) => {
    history.push(getUserPath(name));
  };

  const getFeedLinkElement = () => {
    if (!isUndefined(entityFQN) && !isUndefined(entityType)) {
      return (
        <span className="tw-font-normal" data-testid="headerText">
          <span className="tw-mx-1">posted on</span>
          {isEntityFeed ? (
            <span className="tw-heading" data-testid="headerText-entityField">
              {getEntityFieldDisplay(entityField)}
            </span>
          ) : (
            <>
              <span data-testid="entityType">{entityType} </span>
              <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
                <Link
                  className="tw-break-all"
                  data-testid="entitylink"
                  to={prepareFeedLink(entityType, entityFQN)}>
                  <span>{entityDisplayName(entityType, entityFQN)}</span>
                </Link>
              </EntityPopOverCard>
            </>
          )}
        </span>
      );
    } else {
      return null;
    }
  };

  const getTaskLinkElement = () => {
    if (!isUndefined(entityFQN) && !isUndefined(entityType)) {
      return (
        <span className="tw-font-normal">
          <span className="tw-mx-1">created a task</span>
          <Link
            data-testid="tasklink"
            to={getTaskDetailPath(toString(taskDetails?.id)).pathname}>
            <span>
              {`#${taskDetails?.id} `}
              {taskDetails?.type}
            </span>
          </Link>
          <span className="tw-mx-1">for</span>
          {isEntityFeed ? (
            <span className="tw-heading" data-testid="headerText-entityField">
              {getEntityFieldDisplay(entityField)}
            </span>
          ) : (
            <>
              <span className="tw-pr-1">{entityType}</span>
              <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
                <Link
                  className="tw-break-all"
                  data-testid="entitylink"
                  to={prepareFeedLink(entityType, entityFQN)}>
                  {entityDisplayName(entityType, entityFQN)}
                </Link>
              </EntityPopOverCard>
            </>
          )}
        </span>
      );
    } else {
      return null;
    }
  };

  return (
    <div className={classNames('tw-inline-block', className)}>
      <UserPopOverCard userName={createdBy}>
        <span
          className="thread-author tw-cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onTitleClickHandler(createdBy);
          }}>
          {createdBy}
        </span>
      </UserPopOverCard>

      {feedType === ThreadType.Conversation
        ? getFeedLinkElement()
        : getTaskLinkElement()}

      <span className="tw-text-grey-muted" data-testid="timestamp">
        {timeStamp && ' - ' + getDayTimeByTimeStamp(timeStamp)}
      </span>
    </div>
  );
};

export default FeedCardHeader;
