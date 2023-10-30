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
import { isUndefined } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import EntityPopOverCard from '../../../../components/common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from '../../../../components/common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../../../components/common/ProfilePicture/ProfilePicture';
import { getUserPath } from '../../../../constants/constants';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../../utils/date-time/DateTimeUtils';
import {
  entityDisplayName,
  getEntityField,
  getEntityFieldDisplay,
  getEntityFQN,
  getEntityType,
} from '../../../../utils/FeedUtils';
import { getEntityLink } from '../../../../utils/TableUtils';
import './feed-card-header-v1.style.less';
import FeedCardHeaderName from './FeedCardHeaderName';

interface FeedCardHeaderV1Props {
  about?: string;
  createdBy?: string;
  timeStamp?: number;
  className?: string;
  showUserAvatar?: boolean;
  isEntityFeed?: boolean;
}

const FeedCardHeaderV1 = ({
  about: entityLink = '',
  createdBy = '',
  timeStamp,
  className = '',
  showUserAvatar = true,
  isEntityFeed = false,
}: FeedCardHeaderV1Props) => {
  const { t } = useTranslation();
  const history = useHistory();
  const entityType = getEntityType(entityLink) ?? '';
  const entityFQN = getEntityFQN(entityLink) ?? '';
  const entityField = getEntityField(entityLink) ?? '';
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
              to={getEntityLink(entityType, entityFQN)}>
              <span>{entityDisplayName(entityType, entityFQN)}</span>
            </Link>
          </EntityPopOverCard>
        </>
      )}
    </span>
  );

  return (
    <div className={classNames('feed-header', className)}>
      {showUserAvatar && (
        <UserPopOverCard userName={createdBy}>
          <span className="p-r-xs cursor-pointer" data-testid="authorAvatar">
            <ProfilePicture name={createdBy} type="circle" width="24" />
          </span>
        </UserPopOverCard>
      )}
      <span className="feed-header-content">
        <FeedCardHeaderName
          createdBy={createdBy}
          onTitleClickHandler={onTitleClickHandler}
        />
        {getFeedLinkElement}

        {timeStamp && (
          <Tooltip title={formatDateTime(timeStamp)}>
            <span className="feed-header-timestamp" data-testid="timestamp">
              {getRelativeTime(timeStamp)}
            </span>
          </Tooltip>
        )}
      </span>
    </div>
  );
};

export default FeedCardHeaderV1;
