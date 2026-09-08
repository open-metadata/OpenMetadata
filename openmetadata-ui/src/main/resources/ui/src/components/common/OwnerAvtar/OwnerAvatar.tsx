/*
 *  Copyright 2025 Collate.
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
import { Typography } from 'antd';
import React from 'react';
import { ReactComponent as AssigneesIcon } from '../../../assets/svg/ic-assignees.svg';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import { OwnerType } from '../../../enums/user.enum';
import { EntityReference } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityNameUtils';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import './owner-avtar.less';

interface OwnerAvatarProps {
  owner: EntityReference;
  avatarSize?: number;
  isCompactView?: boolean;
  inheritedIcon?: React.ReactNode;
  isAssignee?: boolean;
}

const getOwnerTestId = (
  isCompactView: boolean | undefined,
  owner: EntityReference
) => !isCompactView && getEntityName(owner);

interface OwnerProfileAvatarProps {
  owner: EntityReference;
  displayName: string;
  avatarSize: number;
  isCompactView?: boolean;
  inheritedIcon?: React.ReactNode;
}

const OwnerProfileAvatar: React.FC<OwnerProfileAvatarProps> = ({
  owner,
  displayName,
  avatarSize,
  isCompactView,
  inheritedIcon,
}) => (
  <div
    className="owner-avatar-icon"
    data-testid={getOwnerTestId(isCompactView, owner)}
    key={owner.id}
    style={{ flexBasis: `${avatarSize}px` }}>
    <ProfilePicture
      displayName={displayName}
      key="profile-picture"
      name={owner.name ?? ''}
      type="circle"
      width={isCompactView && !avatarSize ? '24' : `${avatarSize}`}
    />

    {inheritedIcon && (
      <div className="inherited-icon-styling flex-center">{inheritedIcon}</div>
    )}
  </div>
);

export const OwnerAvatar: React.FC<OwnerAvatarProps> = ({
  owner,
  isCompactView,
  inheritedIcon,
  avatarSize = 32,
  isAssignee,
}) => {
  const displayName = getEntityName(owner);
  const isTeam = owner.type === OwnerType.TEAM;

  if (isAssignee) {
    return (
      <div className="flex w-max-full items-center gap-2">
        {isTeam ? (
          <div className="d-flex gap-2 multi-team-container w-max-full items-center">
            <Icon
              className="owner-team-icon"
              component={AssigneesIcon}
              data-testid={getOwnerTestId(isCompactView, owner)}
            />
            <Typography.Text className="text-sm" ellipsis={{ tooltip: true }}>
              {displayName}
            </Typography.Text>
          </div>
        ) : (
          <OwnerProfileAvatar
            avatarSize={avatarSize}
            displayName={displayName}
            inheritedIcon={inheritedIcon}
            isCompactView={isCompactView}
            owner={owner}
          />
        )}
      </div>
    );
  }

  return isTeam ? (
    <div className="d-flex gap-2 w-max-full items-center">
      <Icon
        className="owner-team-icon"
        component={IconTeamsGrey}
        data-testid={getOwnerTestId(isCompactView, owner)}
        style={{ fontSize: isCompactView ? '16px' : `${avatarSize}px` }}
      />
      {!isCompactView && (
        <Typography.Text className="text-sm" ellipsis={{ tooltip: true }}>
          {displayName}
        </Typography.Text>
      )}
    </div>
  ) : (
    <OwnerProfileAvatar
      avatarSize={avatarSize}
      displayName={displayName}
      inheritedIcon={inheritedIcon}
      isCompactView={isCompactView}
      owner={owner}
    />
  );
};
