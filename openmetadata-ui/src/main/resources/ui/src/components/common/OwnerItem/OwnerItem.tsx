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
import { Typography } from 'antd';
import classNames from 'classnames';
import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import { OwnerType } from '../../../enums/user.enum';
import { EntityReference } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityUtils';
import { getOwnerPath } from '../../../utils/ownerUtils';
import { OwnerAvatar } from '../OwnerAvtar/OwnerAvatar';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';
interface OwnerItemProps {
  owner: EntityReference;
  isCompactView: boolean;
  className?: string;
  ownerDisplayName?: ReactNode;
  avatarSize?: number;
  isAssignee?: boolean;
}

export const OwnerItem: React.FC<OwnerItemProps> = ({
  owner,
  isCompactView,
  className,
  ownerDisplayName,
  avatarSize = 32,
  isAssignee,
}) => {
  const displayName = getEntityName(owner);
  const ownerPath = getOwnerPath(owner);
  const isTeam = owner?.type === OwnerType.TEAM; // Assuming 'type' indicates if the owner is a team

  const inheritedIcon = owner?.inherited ? (
    <InheritIcon className="inherit-icon cursor-pointer" width={8} />
  ) : null;
  if (isCompactView) {
    return (
      <div className={classNames('owner-avatar-container is-compact-view')}>
        <div className="owner-avatar-icon d-flex">
          <OwnerAvatar
            avatarSize={avatarSize}
            inheritedIcon={inheritedIcon}
            isCompactView={isCompactView}
            owner={owner}
          />
        </div>
        <Link
          className={classNames(
            'truncate no-underline font-medium text-xs text-primary',
            className
          )}
          data-testid="owner-link"
          to={ownerPath}>
          <Typography.Text
            data-testid={getEntityName(owner)}
            ellipsis={{ tooltip: true }}>
            {ownerDisplayName ?? displayName}
          </Typography.Text>
        </Link>
      </div>
    );
  }

  return (
    <div className={classNames('owner-avatar-container stacked-view')}>
      {isTeam ? (
        <Link
          className="d-flex no-underline"
          data-testid="owner-link"
          to={ownerPath}>
          <OwnerAvatar
            avatarSize={avatarSize}
            inheritedIcon={inheritedIcon}
            isAssignee={isAssignee}
            isCompactView={isCompactView}
            owner={owner}
          />
        </Link>
      ) : (
        <UserPopOverCard userName={owner.name ?? ''}>
          <Link
            className="d-flex no-underline"
            data-testid="owner-link"
            to={ownerPath}>
            <OwnerAvatar
              avatarSize={avatarSize}
              inheritedIcon={inheritedIcon}
              isAssignee={isAssignee}
              isCompactView={isCompactView}
              owner={owner}
            />
          </Link>
        </UserPopOverCard>
      )}
    </div>
  );
};
