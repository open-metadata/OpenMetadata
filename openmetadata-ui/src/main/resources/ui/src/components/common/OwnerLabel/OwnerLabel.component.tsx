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
  owners = [],
  className,
  onUpdate,
  hasPermission,
  ownerDisplayName,
  placeHolder,
}: {
  owners?: EntityReference[];
  className?: string;
  onUpdate?: (owners?: EntityReference[]) => void;
  hasPermission?: boolean;
  ownerDisplayName?: ReactNode[];
  placeHolder?: string;
}) => {
  const { t } = useTranslation();

  const ownerElements = useMemo(() => {
    if (!owners || owners.length === 0) {
      return (
        <div className="d-inline-flex items-center gap-1">
          <div className="owner-avatar-icon d-flex">
            <Icon
              component={IconUser}
              data-testid="no-owner-icon"
              style={{ fontSize: '18px' }}
            />
          </div>
          <Typography.Text
            className={classNames('font-medium text-xs', className)}
            data-testid="owner-link">
            {placeHolder ?? t('label.no-entity', { entity: t('label.owner') })}
          </Typography.Text>
        </div>
      );
    }

    return owners.map((owner, index) => {
      const displayName = getEntityName(owner);
      const profilePicture =
        owner.type === OwnerType.TEAM ? (
          <Icon
            component={IconTeamsGrey}
            data-testid="team-owner-icon"
            style={{ fontSize: '18px' }}
          />
        ) : (
          <div key={owner.id} style={{ flexBasis: '18px' }}>
            <ProfilePicture
              displayName={displayName}
              key="profile-picture"
              name={owner.name ?? ''}
              type="circle"
              width="18"
            />
          </div>
        );

      const ownerLink = (
        <Link
          className={classNames(
            'no-underline font-medium text-xs text-primary',

            className
          )}
          data-testid="owner-link"
          key={owner.id}
          to={
            owner.type === OwnerType.TEAM
              ? getTeamAndUserDetailsPath(owner.name ?? '')
              : getUserPath(owner.name ?? '')
          }>
          {ownerDisplayName?.[index] ?? displayName}
        </Link>
      );

      return (
        <div className="d-inline-flex items-center gap-1" key={owner.id}>
          <div className="owner-avatar-icon d-flex">{profilePicture}</div>
          {ownerLink}
        </div>
      );
    });
  }, [owners, ownerDisplayName, placeHolder, className, t]);

  const ownerContent = useMemo(() => {
    return (
      <div
        className={classNames(
          'd-inline-flex items-center flex-wrap gap-2',
          { inherited: Boolean(owners?.some((owner) => owner.inherited)) },
          className
        )}
        data-testid="owner-label">
        {ownerElements}
        {owners?.some((owner) => owner.inherited) && (
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
            multiple={{
              user: true,
              team: false,
            }}
            owner={owners}
            onUpdate={(updatedUsers) => {
              onUpdate(updatedUsers);
            }}
          />
        )}
      </div>
    );
  }, [
    onUpdate,
    ownerElements,
    hasPermission,
    owners,
    ownerDisplayName,
    placeHolder,
    className,
  ]);

  return ownerContent;
};
