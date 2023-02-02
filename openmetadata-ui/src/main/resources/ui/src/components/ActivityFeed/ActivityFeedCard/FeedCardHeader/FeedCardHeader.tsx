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

import { Tooltip } from 'antd';
import classNames from 'classnames';
import { isUndefined, toString } from 'lodash';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { getUserPath } from '../../../../constants/constants';
import { ThreadType } from '../../../../generated/entity/feed/thread';
import {
  entityDisplayName,
  getEntityFieldDisplay,
  prepareFeedLink,
} from '../../../../utils/FeedUtils';
import { getTaskDetailPath } from '../../../../utils/TasksUtils';
import {
  getDateTimeFromMilliSeconds,
  getDayTimeByTimeStamp,
} from '../../../../utils/TimeUtils';
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
  const { t } = useTranslation();
  const history = useHistory();
  const onTitleClickHandler = (name: string) => {
    history.push(getUserPath(name));
  };

  const entityCheck = !isUndefined(entityFQN) && !isUndefined(entityType);

  const getFeedLinkElement = entityCheck && (
    <span className="tw-font-normal" data-testid="headerText">
      <span className="tw-mx-1">{t('label.posted-on-lowercase')}</span>
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

  const getTaskLinkElement = entityCheck && (
    <span className="tw-font-normal">
      <span className="tw-mx-1">{t('label.created-a-task-lowercase')}</span>
      <Link
        data-testid="tasklink"
        to={getTaskDetailPath(toString(taskDetails?.id)).pathname}
        onClick={(e) => e.stopPropagation()}>
        <span>
          {`#${taskDetails?.id} `}
          {taskDetails?.type}
        </span>
      </Link>
      <span className="tw-mx-1">{t('label.for-lowercase')}</span>
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
              to={prepareFeedLink(entityType, entityFQN)}
              onClick={(e) => e.stopPropagation()}>
              {entityDisplayName(entityType, entityFQN)}
            </Link>
          </EntityPopOverCard>
        </>
      )}
    </span>
  );

  const getAnnouncementLinkElement = entityCheck && (
    <span className="tw-mx-1">
      {t('message.made-announcement-for-entity', { entity: entityType })}{' '}
      <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
        <Link
          className="tw-break-all"
          data-testid="entitylink"
          to={prepareFeedLink(entityType, entityFQN)}>
          {entityDisplayName(entityType, entityFQN)}
        </Link>
      </EntityPopOverCard>
    </span>
  );

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

      {feedType === ThreadType.Conversation && getFeedLinkElement}
      {feedType === ThreadType.Task && getTaskLinkElement}
      {feedType === ThreadType.Announcement && getAnnouncementLinkElement}

      {timeStamp && (
        <Tooltip
          className="tw-text-grey-muted"
          title={getDateTimeFromMilliSeconds(timeStamp)}>
          <span data-testid="timestamp">
            {' - ' + getDayTimeByTimeStamp(timeStamp)}
          </span>
        </Tooltip>
      )}
    </div>
  );
};

export default FeedCardHeader;
