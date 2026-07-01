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
import { Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { ReactNode, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as TeamsIcons } from '../../../assets/svg/ic-teams.svg';
import { OwnerType } from '../../../enums/user.enum';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getOwnerPath } from '../../../utils/ownerUtils';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import { OwnerAvatarStackProps } from './OwnerAvatarStack.interface';
import { OwnerStackOverflow } from './OwnerStackOverflow.component';

const DEFAULT_MAX_VISIBLE_AVATARS = 2;

export const OwnerAvatarStack: React.FC<OwnerAvatarStackProps> = ({
  owners,
  avatarSize,
  className,
  ownerDisplayName,
  placement = 'horizontal',
  maxVisibleOwners = DEFAULT_MAX_VISIBLE_AVATARS,
}) => {
  const isVertical = placement === 'vertical';

  const { visibleOwners, hiddenOwners, hiddenCount } = useMemo(() => {
    const visible = owners.slice(0, maxVisibleOwners);
    const hidden = owners.slice(maxVisibleOwners);

    return {
      visibleOwners: visible,
      hiddenOwners: hidden,
      hiddenCount: hidden.length,
    };
  }, [owners, maxVisibleOwners]);

  const getOwnerName = (owner: EntityReference): ReactNode => {
    const fallback = getEntityName(owner);

    return ownerDisplayName?.get(owner.name ?? '') ?? fallback;
  };

  const renderTeamBadge = (owner: EntityReference) => {
    const entityName = getEntityName(owner);
    const iconSize = Math.round(avatarSize * 0.6);

    return (
      <span
        className="owner-avatar-stack-team"
        data-testid={entityName}
        style={{ width: avatarSize, height: avatarSize }}>
        <TeamsIcons
          className="owner-avatar-stack-team-icon"
          height={iconSize}
          width={iconSize}
        />
      </span>
    );
  };

  const renderUserBadge = (owner: EntityReference) => {
    const entityName = getEntityName(owner);

    return (
      <span
        className="owner-avatar-stack-user"
        data-testid={entityName}
        style={{ width: avatarSize, height: avatarSize }}>
        <ProfilePicture
          displayName={entityName}
          name={owner.name ?? ''}
          type="circle"
          width={`${avatarSize}`}
        />
      </span>
    );
  };

  const renderStackAvatar = (owner: EntityReference) => {
    const entityName = getEntityName(owner);
    const ownerPath = getOwnerPath(owner);
    const isTeam = owner.type === OwnerType.TEAM;

    const linkContent = (
      <Link
        aria-label={entityName}
        className="owner-avatar-stack-link"
        data-testid="owner-link"
        to={ownerPath}>
        {isTeam ? renderTeamBadge(owner) : renderUserBadge(owner)}
      </Link>
    );

    if (isTeam) {
      return linkContent;
    }

    return (
      <UserPopOverCard userName={owner.name ?? ''}>
        {linkContent}
      </UserPopOverCard>
    );
  };

  const renderRowOwner = (owner: EntityReference) => {
    const entityName = getEntityName(owner);
    const ownerPath = getOwnerPath(owner);
    const isTeam = owner.type === OwnerType.TEAM;

    const linkContent = (
      <Link
        aria-label={entityName}
        className="owner-avatar-stack-row"
        data-testid="owner-link"
        to={ownerPath}>
        {isTeam ? renderTeamBadge(owner) : renderUserBadge(owner)}
        <Typography
          ellipsis
          as="span"
          className="owner-avatar-stack-row-name"
          size="text-sm">
          {getOwnerName(owner)}
        </Typography>
      </Link>
    );

    if (isTeam) {
      return linkContent;
    }

    return (
      <UserPopOverCard userName={owner.name ?? ''}>
        {linkContent}
      </UserPopOverCard>
    );
  };

  if (owners.length === 1) {
    return (
      <div
        className={classNames(
          'owner-avatar-stack owner-avatar-stack-single tw:flex tw:items-center',
          className
        )}
        data-testid="owner-avatar-stack">
        {renderRowOwner(owners[0])}
      </div>
    );
  }

  if (isVertical) {
    return (
      <div
        className={classNames(
          'owner-avatar-stack owner-avatar-stack-vertical tw:flex tw:flex-col tw:gap-2 tw:items-start',
          className
        )}
        data-testid="owner-avatar-stack">
        {visibleOwners.map((owner) => (
          <div className="owner-avatar-stack-row-item" key={owner.id}>
            {renderRowOwner(owner)}
          </div>
        ))}
        {hiddenCount > 0 && (
          <div className="owner-avatar-stack-row-item">
            <OwnerStackOverflow
              avatarSize={avatarSize}
              hiddenCount={hiddenCount}
              ownerDisplayName={ownerDisplayName}
              owners={hiddenOwners}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={classNames(
        'owner-avatar-stack tw:flex tw:items-center',
        className
      )}
      data-testid="owner-avatar-stack">
      <div className="owner-avatar-stack-list tw:flex tw:items-center">
        {visibleOwners.map((owner) => (
          <div className="owner-avatar-stack-item" key={owner.id}>
            {renderStackAvatar(owner)}
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <OwnerStackOverflow
          avatarSize={avatarSize}
          hiddenCount={hiddenCount}
          ownerDisplayName={ownerDisplayName}
          owners={hiddenOwners}
        />
      )}
    </div>
  );
};
