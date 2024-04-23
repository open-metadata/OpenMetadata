/*
 *  Copyright 2024 Collate.
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

import { Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getUserPath } from '../../../../constants/constants';
import { useUserProfile } from '../../../../hooks/user-profile/useUserProfile';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../../utils/date-time/DateTimeUtils';
import {
  getEntityName,
  getEntityNameLabel,
} from '../../../../utils/EntityUtils';
import {
  entityDisplayName,
  getEntityFQN,
  getEntityType,
  getFeedChangeFieldLabel,
  getFeedChangeOperationLabel,
} from '../../../../utils/FeedUtils';
import EntityPopOverCard from '../../../common/PopOverCard/EntityPopOverCard';

import { useTranslation } from 'react-i18next';
import { EntityField } from '../../../../constants/Feeds.constants';
import { EntityType } from '../../../../enums/entity.enum';
import entityUtilClassBase from '../../../../utils/EntityUtilClassBase';
import UserPopOverCard from '../../../common/PopOverCard/UserPopOverCard';
import './feed-card-header-v2.less';
import { FeedCardHeaderV2Props } from './FeedCardHeaderV2.interface';

const FeedCardHeaderV2 = ({
  className = '',
  about: entityLink = '',
  createdBy = '',
  timeStamp,
  isEntityFeed = false,
  isAnnouncement = false,
  fieldOperation,
  fieldName,
}: FeedCardHeaderV2Props) => {
  const [, , user] = useUserProfile({
    permission: true,
    name: createdBy ?? '',
  });
  const { t } = useTranslation();

  const { entityFQN, entityType } = useMemo(() => {
    const entityFQN = getEntityFQN(entityLink) ?? '';
    const entityType = getEntityType(entityLink) ?? '';

    return { entityFQN, entityType };
  }, [entityLink]);

  const entityCheck = useMemo(
    () => !isUndefined(entityFQN) && !isUndefined(entityType),
    [entityFQN, entityType]
  );

  const isUserOrTeam = useMemo(
    () => [EntityType.USER, EntityType.TEAM].includes(entityType),
    [entityType]
  );

  return (
    <div className={classNames('feed-card-header-v2', className)}>
      <Typography.Text className="break-word">
        <UserPopOverCard userName={createdBy}>
          <Link className="thread-author" to={getUserPath(createdBy)}>
            {getEntityName(user)}
          </Link>
        </UserPopOverCard>

        {entityCheck && !isEntityFeed && (
          <Typography.Text className="font-normal" data-testid="headerText">
            {isAnnouncement ? (
              <Typography.Text className="m-r-xss">
                {t('label.posted-on-lowercase')}
              </Typography.Text>
            ) : (
              <>
                <Typography.Text className="m-r-xss">
                  {getFeedChangeOperationLabel(fieldOperation)}
                </Typography.Text>
                <Typography.Text className="m-r-xss" data-testid="entityType">
                  {getFeedChangeFieldLabel(fieldName as EntityField)}
                </Typography.Text>
                <Typography.Text className="m-r-xss">
                  {t('label.for-lowercase')}
                </Typography.Text>
                <Typography.Text className="m-r-xss">
                  {getEntityNameLabel(entityType)}
                </Typography.Text>
              </>
            )}

            {isUserOrTeam ? (
              <UserPopOverCard
                showUserName
                showUserProfile={false}
                userName={createdBy}>
                <Link
                  className="break-all text-body"
                  data-testid="entity-link"
                  to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
                  <span>{entityDisplayName(entityType, entityFQN)}</span>
                </Link>
              </UserPopOverCard>
            ) : (
              <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
                <Link
                  className="break-all"
                  data-testid="entity-link"
                  to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
                  <span>{entityDisplayName(entityType, entityFQN)}</span>
                </Link>
              </EntityPopOverCard>
            )}
          </Typography.Text>
        )}
      </Typography.Text>
      {timeStamp && (
        <Tooltip
          color="white"
          overlayClassName="timestamp-tooltip"
          title={formatDateTime(timeStamp)}>
          <span
            className="feed-card-header-v2-timestamp"
            data-testid="timestamp">
            {getRelativeTime(timeStamp)}
          </span>
        </Tooltip>
      )}
    </div>
  );
};

export default FeedCardHeaderV2;
