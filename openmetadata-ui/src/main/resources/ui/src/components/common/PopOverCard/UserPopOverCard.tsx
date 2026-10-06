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

import { Popover, PopoverTrigger } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { FC, forwardRef, ReactNode } from 'react';
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

/**
 * The link rendered when a caller passes no children. Extracted so the card
 * itself stays under the complexity limit.
 *
 * `...rest` and the forwarded ref are both load-bearing. PopoverTrigger clones
 * this element to merge the hover handlers in, and react-aria anchors the panel
 * to the trigger's DOM node. A plain function component swallows both: the card
 * never opens, and once it does it renders in the page corner instead of beside
 * the trigger. A host element would get them applied for free.
 */
const DefaultTrigger = forwardRef<
  HTMLAnchorElement,
  Pick<
    UserPopOverCardProps,
    | 'className'
    | 'displayName'
    | 'showUserName'
    | 'showUserProfile'
    | 'userName'
  > & { profilePicture: JSX.Element; type: OwnerType }
>(
  (
    {
      className,
      displayName,
      profilePicture,
      showUserName,
      showUserProfile,
      type,
      userName,
      ...rest
    },
    ref
  ) => (
    <Link
      {...rest}
      className={classNames(
        'assignee-item d-flex gap-1 cursor-pointer items-center',
        { 'm-r-xs': !showUserName && showUserProfile },
        className
      )}
      data-testid={userName}
      ref={ref}
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
  )
);
DefaultTrigger.displayName = 'DefaultTrigger';

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

  const trigger = (children as ReactNode) ?? (
    <DefaultTrigger
      className={className}
      displayName={displayName}
      profilePicture={profilePicture}
      showUserName={showUserName}
      showUserProfile={showUserProfile}
      type={type}
      userName={userName}
    />
  );

  return (
    // antd's Popover defaulted to `placement="top"`; react-aria defaults to
    // bottom, so it is set explicitly. `align={{ targetOffset: [0, -10] }}` is
    // dropped rather than ported: it pulled the panel back over antd's arrow
    // and spacer so the pointer could reach it without crossing dead space.
    // Core draws no arrow, and `closeDelay` already forgives the gap.
    <PopoverTrigger trigger="hover">
      {trigger}
      <Popover
        className="tw:max-w-125"
        containerClassName="tw:flex tw:flex-col"
        placement="top">
        <div className="tw:border-b tw:border-secondary tw:px-4 tw:py-2">
          {isTeam ? (
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
          )}
        </div>
        <div className="tw:px-4 tw:py-3">
          {isTeam ? (
            <TeamPopoverContent teamName={userName} />
          ) : (
            <PopoverContent type={type} userName={userName} />
          )}
        </div>
      </Popover>
    </PopoverTrigger>
  );
};

export default UserPopOverCard;
