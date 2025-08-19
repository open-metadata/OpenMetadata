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

import { Tooltip } from '../../../common/AntdCompat';;
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ThreadType } from '../../../../generated/entity/feed/thread';
import { useUserProfile } from '../../../../hooks/user-profile/useUserProfile';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import {
  entityDisplayName,
  getEntityFieldDisplay,
  prepareFeedLink,
} from '../../../../utils/FeedUtils';
import { getUserPath } from '../../../../utils/RouterUtils';
import { getTaskDetailPath } from '../../../../utils/TasksUtils';
import EntityPopOverCard from '../../../common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from '../../../common/PopOverCard/UserPopOverCard';
import { FeedHeaderProp } from '../ActivityFeedCard.interface';
import './feed-card-header-v1.style.less';

const FeedCardHeader: FC<FeedHeaderProp> = ({
  className,
  createdBy,
  timeStamp,
  entityFQN,
  entityType,
  entityField,
  isEntityFeed,
  feedType,
  task,
}) => {
  const [, , user] = useUserProfile({
    permission: true,
    name: createdBy ?? '',
  });

  const { t } = useTranslation();

  const { task: taskDetails } = task;

  const entityCheck = !isUndefined(entityFQN) && !isUndefined(entityType);

  const getFeedLinkElement = entityCheck && (
    <span data-testid="headerText">
      <span className="m-x-xss">{t('label.posted-on-lowercase')}</span>
      {isEntityFeed ? (
        <span className="font-medium" data-testid="headerText-entityField">
          {getEntityFieldDisplay(entityField)}
        </span>
      ) : (
        <>
          <span data-testid="entityType">{entityType} </span>
          <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
            <Link
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
    <span>
      <span>{t('label.created-a-task-lowercase')}</span>
      <Link
        data-testid="tasklink"
        to={getTaskDetailPath(task)}
        onClick={(e) => e.stopPropagation()}>
        <span className="m-x-xss">
          {`#${taskDetails?.id} `}
          {taskDetails?.type}
        </span>
      </Link>
      <span className="m-r-xss">{t('label.for-lowercase')}</span>
      {isEntityFeed ? (
        <span data-testid="headerText-entityField">
          {getEntityFieldDisplay(entityField)}
        </span>
      ) : (
        <>
          <span>{entityType}</span>
          <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
            <Link
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
    <span>{t('message.made-announcement')} </span>
  );

  return (
    <div className={classNames('d-inline-block feed-header', className)}>
      <UserPopOverCard userName={createdBy}>
        <Link className="thread-author m-r-xss" to={getUserPath(createdBy)}>
          {getEntityName(user)}
        </Link>
      </UserPopOverCard>

      {feedType === ThreadType.Conversation && getFeedLinkElement}
      {feedType === ThreadType.Task && getTaskLinkElement}
      {feedType === ThreadType.Announcement && getAnnouncementLinkElement}

      {timeStamp && (
        <Tooltip className="text-grey-muted" title={formatDateTime(timeStamp)}>
          <span className="feed-header-timestamp" data-testid="timestamp">
            {' - ' + getRelativeTime(timeStamp)}
          </span>
        </Tooltip>
      )}
    </div>
  );
};

export default FeedCardHeader;
