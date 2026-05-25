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
import classNames from 'classnames';
import { reverse } from 'lodash';
import { ReactNode, useMemo, useState } from 'react';
import { ReactComponent as IconUser } from '../../../assets/svg/user.svg';
import { EntityReference } from '../../../generated/entity/type';
import { OwnerItem } from '../OwnerItem/OwnerItem';
import { AvatarSize } from '../OwnerLabel/OwnerLabel.interface';
import { AVATAR_SIZE_CLASS_MAP } from '../OwnerUserTeamList/OwnerUserTeamList.constants';
import { OwnerReveal } from '../RemainingOwner/OwnerReveal';

interface OwnerUserListProps {
  owners: EntityReference[];
  maxVisibleOwners: number;
  avatarSize: AvatarSize;
  className?: string;
  isCompactView: boolean;
  ownerLabelClassName?: string;
  ownerDisplayName?: Map<string, ReactNode>;
}

const OwnerUserList = ({
  owners,
  isCompactView,
  avatarSize,
  className,
  ownerDisplayName,
  ownerLabelClassName,
  maxVisibleOwners,
}: OwnerUserListProps) => {
  const [showAllOwners, setShowAllOwners] = useState(false);

  const { showMoreButton, renderVisibleOwners, remainingOwnersCount } =
    useMemo(() => {
      const visibleOwners = showAllOwners
        ? owners
        : owners.slice(0, maxVisibleOwners);
      const remainingOwnersCount = owners.length - maxVisibleOwners;

      return {
        showMoreButton: remainingOwnersCount > 0,
        renderVisibleOwners: isCompactView
          ? visibleOwners
          : reverse(visibleOwners),
        remainingOwnersCount,
      };
    }, [owners, showAllOwners, maxVisibleOwners]);

  return (
    <div className="tw:w-full tw:flex tw:items-center">
      {!isCompactView && (
        <IconUser
          className={classNames(
            'tw:text-gray-700 tw:flex-none tw:mr-0.5',
            AVATAR_SIZE_CLASS_MAP[avatarSize]
          )}
          data-testid="user-owner-icon"
        />
      )}

      <div
        className={classNames(
          'avatar-group tw:relative tw:ml-1 tw:w-full',
          {
            'tw:mr-2 tw:flex-row tw:gap-2 tw:flex-wrap': isCompactView,
            'tw:mr-0 tw:flex-row-reverse tw:gap-0 tw:flex-nowrap':
              !isCompactView,
          },
          className
        )}>
        {renderVisibleOwners.map((owner: EntityReference) => (
          <div
            className={classNames(
              {
                'w-max-full': isCompactView,
              },
              ownerLabelClassName
            )}
            key={owner.id}>
            <OwnerItem
              avatarSize={avatarSize}
              className={className}
              isCompactView={isCompactView}
              owner={owner}
              ownerDisplayName={ownerDisplayName?.get(owner.name ?? '')}
            />
          </div>
        ))}
      </div>

      {showMoreButton && (
        <OwnerReveal
          avatarSize={isCompactView ? 24 : avatarSize}
          isCompactView={isCompactView}
          owners={owners.slice(maxVisibleOwners)}
          remainingCount={remainingOwnersCount}
          setShowAllOwners={setShowAllOwners}
          showAllOwners={showAllOwners}
        />
      )}
    </div>
  );
};

export default OwnerUserList;
