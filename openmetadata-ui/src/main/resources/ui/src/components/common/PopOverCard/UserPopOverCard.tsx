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

import { HoverCard } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { FC, MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { OwnerType } from '../../../enums/user.enum';
import { useEntityPopoverData } from '../../../hooks/popover/useEntityPopoverData';
import { useUserLabel } from '../../../hooks/user-profile/useUserLabel';
import { getEntityName } from '../../../utils/EntityNameUtils';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import { PopoverContent } from './PopoverContent.component';
import { PopoverTitle } from './PopoverTitle.component';
import { TeamPopoverContent } from './TeamPopoverContent.component';
import { TeamPopoverTitle } from './TeamPopoverTitle.component';
import { UserPopOverCardProps } from './UserPopOverCard.interface';
import { getUserPopoverPath } from './UserPopOverCard.utils';

// A team card has no profile store entry; resolve its display name through the popover's own
// query, which the hover card reuses.
const TeamName: FC<{ teamName: string }> = ({ teamName }) => {
  const { data } = useEntityPopoverData(teamName, OwnerType.TEAM);

  return <>{getEntityName(data) || teamName}</>;
};

const UserPopoverBody: FC<{
  profilePicture: JSX.Element;
  type: OwnerType;
  userName: string;
  onTitleClick?: () => void;
}> = ({ profilePicture, type, userName, onTitleClick }) => (
  <div className="tw:flex tw:flex-col tw:gap-3" data-testid="user-popover-card">
    {type === OwnerType.TEAM ? (
      <>
        <TeamPopoverTitle profilePicture={profilePicture} teamName={userName} />
        <TeamPopoverContent teamName={userName} />
      </>
    ) : (
      <>
        <PopoverTitle
          profilePicture={profilePicture}
          type={type}
          userName={userName}
          onTitleClick={onTitleClick}
        />
        <PopoverContent type={type} userName={userName} />
      </>
    )}
  </div>
);

const UserPopOverCard: FC<UserPopOverCardProps> = ({
  userName,
  displayName,
  type = OwnerType.USER,
  showUserName = false,
  showUserProfile = true,
  children,
  className,
  profileWidth = 24,
  to,
  onTitleClick,
}) => {
  const isTeam = type === OwnerType.TEAM;
  const userLabel = useUserLabel({
    userName,
    displayName,
    enabled: showUserName && !children && !isTeam,
  });
  const label =
    isTeam && !displayName ? <TeamName teamName={userName} /> : userLabel;
  const handleTitleClick = (event: MouseEvent) => {
    if (onTitleClick) {
      event.preventDefault();
      onTitleClick();
    }
  };
  const profilePicture = (
    <ProfilePicture
      avatarType="outlined"
      isTeam={isTeam}
      name={userName}
      width={`${profileWidth}`}
    />
  );

  return (
    <HoverCard
      content={
        <UserPopoverBody
          profilePicture={profilePicture}
          type={type}
          userName={userName}
          onTitleClick={onTitleClick}
        />
      }>
      {(children as ReactNode) ?? (
        <Link
          className={classNames(
            'assignee-item d-flex gap-1 cursor-pointer items-center',
            {
              'm-r-xs': !showUserName && showUserProfile,
            },
            className
          )}
          data-testid={userName}
          to={to ?? getUserPopoverPath(isTeam, userName)}
          onClick={handleTitleClick}>
          {showUserProfile ? profilePicture : null}
          {showUserName ? <span className="truncate">{label}</span> : null}
        </Link>
      )}
    </HoverCard>
  );
};

export default UserPopOverCard;
