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

import { Popover } from 'antd';
import classNames from 'classnames';
import { FC, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { OwnerType } from '../../../enums/user.enum';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
} from '../../../utils/RouterUtils';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import { PopoverContent } from './PopoverContent.component';
import { PopoverTitle } from './PopoverTitle.component';
import { TeamPopoverContent } from './TeamPopoverContent.component';
import { TeamPopoverTitle } from './TeamPopoverTitle.component';
import { UserPopOverCardProps } from './UserPopOverCard.interface';

const UserPopOverCard: FC<UserPopOverCardProps> = ({
  userName,
  displayName,
  type = OwnerType.USER,
  showUserName = false,
  showUserProfile = true,
  children,
  className,
  profileWidth = 24,
}) => {
  const isTeam = type === OwnerType.TEAM;
  const profilePicture = (
    <ProfilePicture
      avatarType="outlined"
      isTeam={isTeam}
      name={userName}
      width={`${profileWidth}`}
    />
  );

  return (
    <Popover
      align={{ targetOffset: [0, -10] }}
      content={
        isTeam ? (
          <TeamPopoverContent teamName={userName} />
        ) : (
          <PopoverContent type={type} userName={userName} />
        )
      }
      overlayClassName="ant-popover-card"
      title={
        isTeam ? (
          <TeamPopoverTitle
            profilePicture={profilePicture}
            teamName={userName}
          />
        ) : (
          <PopoverTitle
            profilePicture={profilePicture}
            type={type}
            userName={userName}
          />
        )
      }
      trigger="hover">
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
          to={
            type === OwnerType.TEAM
              ? getTeamAndUserDetailsPath(userName)
              : getUserPath(userName ?? '')
          }>
          {showUserProfile ? profilePicture : null}
          {showUserName ? (
            <span className="truncate">{displayName ?? userName}</span>
          ) : null}
        </Link>
      )}
    </Popover>
  );
};

export default UserPopOverCard;
