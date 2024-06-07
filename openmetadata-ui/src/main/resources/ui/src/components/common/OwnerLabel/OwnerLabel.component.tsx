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
import Icon from '@ant-design/icons';
import { Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { isNil } from 'lodash';
import React, { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import { ReactComponent as IconUser } from '../../../assets/svg/user.svg';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
} from '../../../constants/constants';
import { OwnerType } from '../../../enums/user.enum';
import { EntityReference } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityUtils';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import { UserTeamSelectableList } from '../UserTeamSelectableList/UserTeamSelectableList.component';
import './owner-label.less';

import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';

export const OwnerLabel = ({
  owner,
  className,
  onUpdate,
  hasPermission,
  ownerDisplayName,
  placeHolder,
  pills = false,
}: {
  owner?: EntityReference;
  className?: string;
  onUpdate?: (owner?: EntityReference) => void;
  hasPermission?: boolean;
  ownerDisplayName?: ReactNode;
  placeHolder?: string;
  pills?: boolean;
}) => {
  const displayName = getEntityName(owner);
  const { t } = useTranslation();

  const profilePicture = useMemo(() => {
    if (isNil(owner)) {
      return (
        <Icon
          component={IconUser}
          data-testid="no-owner-icon"
          style={{ fontSize: '18px' }}
        />
      );
    }

    return owner.type === OwnerType.TEAM ? (
      <Icon
        component={IconTeamsGrey}
        data-testid="team-owner-icon"
        style={{ fontSize: '18px' }}
      />
    ) : (
      <div style={{ flexBasis: '18px' }}>
        <ProfilePicture
          displayName={displayName}
          key="profile-picture"
          name={owner.name ?? ''}
          type="circle"
          width="18"
        />
      </div>
    );
  }, [owner, displayName, pills]);

  return (
    <div
      className={classNames(
        'd-flex items-center',
        { 'gap-2': !pills, 'owner-pills': pills },
        { inherited: Boolean(owner?.inherited) },
        className
      )}
      data-testid="owner-label">
      <div className="owner-avatar-icon d-flex">{profilePicture}</div>

      {displayName ? (
        <Link
          className={classNames(
            'no-underline',
            { 'font-medium text-xs text-primary ': !pills },
            className
          )}
          data-testid="owner-link"
          to={
            owner?.type === OwnerType.TEAM
              ? getTeamAndUserDetailsPath(owner?.name ?? '')
              : getUserPath(owner?.name ?? '')
          }>
          {ownerDisplayName ?? displayName}
        </Link>
      ) : (
        <Typography.Text
          className={classNames('font-medium text-xs', className)}
          data-testid="owner-link">
          {placeHolder ?? t('label.no-entity', { entity: t('label.owner') })}
        </Typography.Text>
      )}

      {pills && Boolean(owner?.inherited) && (
        <Tooltip
          title={t('label.inherited-entity', {
            entity: t('label.user'),
          })}>
          <InheritIcon className="inherit-icon cursor-pointer" width={14} />
        </Tooltip>
      )}

      {onUpdate && (
        <UserTeamSelectableList
          hasPermission={Boolean(hasPermission)}
          owner={owner}
          onUpdate={(updatedUser) => onUpdate(updatedUser as EntityReference)}
        />
      )}
    </div>
  );
};
