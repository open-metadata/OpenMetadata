/*
 *  Copyright 2026 Collate.
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

import classNames from 'classnames';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../../components/common/ProfilePicture/ProfilePicture';
import { OwnerType } from '../../../enums/user.enum';
import { EntityReference } from '../../../generated/type/entityReference';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { getEntityName } from '../../../utils/EntityNameUtils';
import React from 'react';

export interface UserChipProps {
  /**
   * The user or team to render. A bare login string is accepted for payloads
   * that carry no reference (e.g. an announcement's `createdBy`).
   */
  user?: EntityReference | string;
  avatarSize?: number;
  className?: string;
  /** Avatar only — for dense rows where the name is already in the sentence. */
  hideName?: boolean;
}

/**
 * The one way to render a user: avatar plus *display* name, with the shared
 * hover card (display name, login, teams) covering both.
 *
 * The card wraps the chip rather than using its own link, so a chip inside an
 * already-clickable row neither nests an anchor nor hijacks the row's click.
 */
const UserChip: React.FC<UserChipProps> = ({
  user,
  avatarSize = 18,
  className,
  hideName = false,
}) => {
  const reference = typeof user === 'string' ? { name: user } : user;
  const login = reference?.name;
  const isTeam =
    (reference as EntityReference | undefined)?.type === OwnerType.TEAM;
  // `permission: false` makes this a pure read of the store ProfilePicture
  // already populates, so a reference with no displayName still resolves.
  const [, , profile] = useUserProfile({
    permission: false,
    name: login ?? '',
    isTeam,
  });

  const displayName =
    (reference as EntityReference | undefined)?.displayName?.trim() ||
    getEntityName(profile as unknown as EntityReference) ||
    login ||
    '';

  return login ? (
    <UserPopOverCard
      type={isTeam ? OwnerType.TEAM : OwnerType.USER}
      userName={login}>
      <span
        className={classNames(
          // w-fit: the hover card is centred on this box, so a chip stretched
          // to its grid cell would anchor the card to the cell's centre.
          'tw:inline-flex tw:w-fit tw:min-w-0 tw:max-w-full tw:items-center tw:gap-1.5',
          className
        )}
        data-testid={`user-chip-${login}`}>
        <ProfilePicture
          displayName={displayName}
          isTeam={isTeam}
          name={login}
          width={`${avatarSize}`}
        />
        {hideName ? null : <span className="tw:truncate">{displayName}</span>}
      </span>
    </UserPopOverCard>
  ) : null;
};

export default UserChip;
