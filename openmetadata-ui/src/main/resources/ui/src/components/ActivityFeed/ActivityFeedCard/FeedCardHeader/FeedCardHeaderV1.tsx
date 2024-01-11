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
import { Link } from 'react-router-dom';
import EntityPopOverCard from '../../../../components/common/PopOverCard/EntityPopOverCard';
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

import { EntityType } from '../../../../enums/entity.enum';
import entityUtilClassBase from '../../../../utils/EntityUtilClassBase';
import UserPopOverCard from '../../../common/PopOverCard/UserPopOverCard';
import './feed-card-header-v1.style.less';

interface FeedCardHeaderV1Props {
  about?: string;
  createdBy?: string;
  timeStamp?: number;
  className?: string;
  isEntityFeed?: boolean;
}

const FeedCardHeaderV1 = ({
  about: entityLink = '',
  createdBy = '',
  timeStamp,
  className = '',
  isEntityFeed = false,
}: FeedCardHeaderV1Props) => {
  const { t } = useTranslation();

  const entityType = getEntityType(entityLink) ?? '';
  const entityFQN = getEntityFQN(entityLink) ?? '';
  const entityField = getEntityField(entityLink) ?? '';
  const entityCheck = !isUndefined(entityFQN) && !isUndefined(entityType);
  const isUserOrTeam = [EntityType.USER, EntityType.TEAM].includes(entityType);

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
          {isUserOrTeam ? (
            <UserPopOverCard
              showUserName
              showUserProfile={false}
              userName={createdBy}>
              <Link
                className="break-all"
                data-testid="entitylink"
                to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
                <span>{entityDisplayName(entityType, entityFQN)}</span>
              </Link>
            </UserPopOverCard>
          ) : (
            <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
              <Link
                className="break-all"
                data-testid="entitylink"
                to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
                <span>{entityDisplayName(entityType, entityFQN)}</span>
              </Link>
            </EntityPopOverCard>
          )}
        </>
      )}
    </span>
  );

  return (
    <div className={classNames('feed-header', className)}>
      <UserPopOverCard
        showUserName
        className="thread-author"
        userName={createdBy}
      />
      {getFeedLinkElement}

      {timeStamp && (
        <Tooltip title={formatDateTime(timeStamp)}>
          <span className="feed-header-timestamp" data-testid="timestamp">
            {getRelativeTime(timeStamp)}
          </span>
        </Tooltip>
      )}
    </div>
  );
};

export default FeedCardHeaderV1;
