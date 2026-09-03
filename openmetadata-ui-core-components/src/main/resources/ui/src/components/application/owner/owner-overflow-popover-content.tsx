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
import type { ReactNode } from 'react';
import type { AvatarSize, OwnerRef } from '../../../types';
import { Divider } from '../../base/divider/divider';
import { OwnerChip } from './owner-chip';

export interface OwnerOverflowPopoverContentProps {
  owners: OwnerRef[];
  avatarSize: AvatarSize;
  ownerDisplayName?: Map<string, ReactNode>;
  overflowTitleLabel?: string;
  overflowTeamsLabel?: string;
  overflowUsersLabel?: string;
}

// The overflow popover lists every owner (not just the hidden ones) grouped
// by type, so opening it always shows the complete picture — matching the
// "N Owners" summary a viewer expects when they click to see who's on it.
// Shared by both Owner's compact overflow trigger and OwnerAvatarStack's.
export const OwnerOverflowPopoverContent = ({
  owners,
  avatarSize,
  ownerDisplayName,
  overflowTitleLabel = 'Owners',
  overflowTeamsLabel = 'Teams',
  overflowUsersLabel = 'Users',
}: OwnerOverflowPopoverContentProps) => {
  const teamOwners = owners.filter((owner) => owner.type === 'team');
  const userOwners = owners.filter((owner) => owner.type !== 'team');

  const renderGroup = (label: string, group: OwnerRef[]) =>
    group.length > 0 && (
      <div className="tw:flex tw:flex-col tw:gap-1">
        <span className="tw:px-2 tw:pb-1 tw:text-xs tw:font-medium tw:text-quaternary">
          {label} ({group.length})
        </span>
        {group.map((owner) => (
          <div
            className="tw:rounded-md tw:transition-colors hover:tw:bg-secondary"
            key={owner.id}>
            <OwnerChip
              avatarSize={avatarSize}
              className="tw:w-full tw:px-2 tw:py-1.5"
              isCompactView={false}
              owner={owner}
              ownerDisplayName={ownerDisplayName}
            />
          </div>
        ))}
      </div>
    );

  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:p-4 tw:min-w-56 tw:max-w-72">
      <span className="tw:text-sm tw:font-medium tw:text-primary">
        {owners.length} {overflowTitleLabel}
      </span>
      <Divider />
      {renderGroup(overflowTeamsLabel, teamOwners)}
      {teamOwners.length > 0 && userOwners.length > 0 && <Divider />}
      {renderGroup(overflowUsersLabel, userOwners)}
    </div>
  );
};
