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
import { cx } from '@/utils/cx';
import { AvatarGroup } from '../../base/avatar/avatar-group';
import { OwnerChip } from './owner-chip';
import type { OwnerAvatarStackProps } from './owner.types';

export const OwnerAvatarStack = ({
  owners,
  avatarSize = 24,
  maxVisibleOwners = 3,
  ownerDisplayName,
  renderOwnerContent,
  placement = 'horizontal',
  className,
}: OwnerAvatarStackProps) => {
  // A single owner renders as avatar + name (+ link when a href is present),
  // regardless of placement, so the owner name stays visible in headers and
  // side panels. Multiple owners collapse into the overlapping avatar stack.
  if (owners.length === 1) {
    const owner = owners[0];
    const chip = (
      <OwnerChip
        avatarSize={avatarSize}
        isCompactView={false}
        owner={owner}
        ownerDisplayName={ownerDisplayName}
      />
    );

    return (
      <div className={cx('tw:flex tw:items-center', className)}>
        {renderOwnerContent ? renderOwnerContent(owner, chip) : chip}
      </div>
    );
  }

  if (placement === 'vertical') {
    return (
      <div
        className={cx(
          'tw:flex tw:flex-col tw:items-start tw:gap-2',
          className
        )}>
        {owners.map((owner) => (
          <OwnerChip
            avatarSize={avatarSize}
            isCompactView={false}
            key={owner.id}
            owner={owner}
            ownerDisplayName={ownerDisplayName}
          />
        ))}
      </div>
    );
  }

  return (
    <AvatarGroup
      avatarSize={avatarSize}
      className={className}
      maxCount={maxVisibleOwners}
      ownerDisplayName={ownerDisplayName}
      owners={owners}
      renderOwnerContent={renderOwnerContent}
    />
  );
};
