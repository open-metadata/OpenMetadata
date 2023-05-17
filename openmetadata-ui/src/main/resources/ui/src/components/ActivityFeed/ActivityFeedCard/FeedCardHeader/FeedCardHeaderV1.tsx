/*
 *  Copyright 2023 Collate.
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
import EntityPopOverCard from 'components/common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from 'components/common/PopOverCard/UserPopOverCard';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import { getUserPath } from 'constants/constants';
import { Thread } from 'generated/entity/feed/thread';
import { isUndefined } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import {
  entityDisplayName,
  getEntityField,
  getEntityFieldDisplay,
  getEntityFQN,
  getEntityType,
  prepareFeedLink,
} from 'utils/FeedUtils';
import {
  getDateTimeFromMilliSeconds,
  getDayTimeByTimeStamp,
} from 'utils/TimeUtils';
import './feed-card-header-v1.style.less';

interface props {
  feed: Thread;
  className?: string;
  showUserAvatar?: boolean;
  isEntityFeed?: boolean;
}

const FeedCardHeaderV1 = ({
  feed: { about: entityLink = '', createdBy = '', threadTs: timeStamp },
  className = '',
  showUserAvatar = true,
  isEntityFeed = false,
}: props) => {
  const { t } = useTranslation();
  const history = useHistory();
  const entityType = getEntityType(entityLink as string) || '';
  const entityFQN = getEntityFQN(entityLink as string) || '';
  const entityField = getEntityField(entityLink as string) || '';
  const entityCheck = !isUndefined(entityFQN) && !isUndefined(entityType);

  const onTitleClickHandler = (name: string) => {
    history.push(getUserPath(name));
  };

  const getFeedLinkElement = entityCheck && (
    <span className="font-normal" data-testid="headerText">
      <span className="m-x-xss">{t('label.posted-on-lowercase')}</span>
      {isEntityFeed ? (
        <span data-testid="headerText-entityField">
          {getEntityFieldDisplay(entityField)}
        </span>
      ) : (
        <>
          <span data-testid="entityType">{entityType} </span>
          <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
            <Link
              className="break-all"
              data-testid="entitylink"
              to={prepareFeedLink(entityType, entityFQN)}>
              <span>{entityDisplayName(entityType, entityFQN)}</span>
            </Link>
          </EntityPopOverCard>
        </>
      )}
    </span>
  );

  return (
    <div className={classNames('d-inline-block feed-header', className)}>
      <UserPopOverCard userName={createdBy}>
        {showUserAvatar && (
          <ProfilePicture id="" name={createdBy} type="circle" width="32" />
        )}
        <span
          className="p-l-xs thread-author cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onTitleClickHandler(createdBy);
          }}>
          {createdBy}
        </span>
      </UserPopOverCard>

      {getFeedLinkElement}

      {timeStamp && (
        <Tooltip title={getDateTimeFromMilliSeconds(timeStamp)}>
          <span className="feed-header-timestamp" data-testid="timestamp">
            {getDayTimeByTimeStamp(timeStamp)}
          </span>
        </Tooltip>
      )}
    </div>
  );
};

export default FeedCardHeaderV1;
