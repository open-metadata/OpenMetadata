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
import { Box, useTheme } from '@mui/material';
import classNames from 'classnames';
import { reverse } from 'lodash';
import { ReactNode, useMemo, useState } from 'react';
import { ReactComponent as IconUser } from '../../../assets/svg/user.svg';
import { EntityReference } from '../../../generated/entity/type';
import { OwnerItem } from '../OwnerItem/OwnerItem';
import { OwnerReveal } from '../RemainingOwner/OwnerReveal';

interface OwnerUserListProps {
  owners: EntityReference[];
  maxVisibleOwners: number;
  avatarSize: number;
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
  const theme = useTheme();
  const [showAllOwners, setShowAllOwners] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { showMoreButton, renderVisibleOwners, remainingOwnersCount } =
    useMemo(() => {
      const visibleOwners = showAllOwners
        ? owners
        : owners.slice(0, maxVisibleOwners);
      const remainingOwnersCount = owners.length - maxVisibleOwners;

      return {
        showMoreButton: remainingOwnersCount > 0 && !showAllOwners,
        renderVisibleOwners: isCompactView
          ? visibleOwners
          : reverse(visibleOwners),
        remainingOwnersCount,
      };
    }, [owners, showAllOwners, maxVisibleOwners]);

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
      }}>
      {!isCompactView && (
        <IconUser
          data-testid="user-owner-icon"
          style={{
            width: avatarSize,
            height: avatarSize,
            color: theme.palette.allShades.gray[700],
            flex: 'none',
            marginRight: '2px',
          }}
        />
      )}

      <Box
        className={classNames('avatar-group', className)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          marginLeft: '4px',
          width: '100%',
          marginRight: isCompactView ? '8px' : '0',
          flexDirection: isCompactView ? 'inherit' : 'row-reverse',
          gap: isCompactView ? '8px' : '0',
          flexWrap: isCompactView ? 'wrap' : 'initial',
        }}>
        {renderVisibleOwners.map((owner: EntityReference) => (
          <Box
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
          </Box>
        ))}
      </Box>

      {showMoreButton && (
        <OwnerReveal
          avatarSize={isCompactView ? 24 : avatarSize}
          isCompactView={isCompactView}
          isDropdownOpen={isDropdownOpen}
          owners={owners.slice(maxVisibleOwners)}
          remainingCount={remainingOwnersCount}
          setIsDropdownOpen={setIsDropdownOpen}
          setShowAllOwners={setShowAllOwners}
          showAllOwners={showAllOwners}
        />
      )}
    </Box>
  );
};

export default OwnerUserList;
