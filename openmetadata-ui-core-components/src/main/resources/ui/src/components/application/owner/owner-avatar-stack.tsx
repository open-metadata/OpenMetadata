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
import { Popover, PopoverTrigger } from '../../application/popover/popover';
import { OwnerChip } from './owner-chip';
import type { OwnerAvatarStackProps } from './owner.types';

export const OwnerAvatarStack = ({
  owners,
  avatarSize = 24,
  maxVisibleOwners = 3,
  ownerDisplayName,
  placement = 'horizontal',
  className,
}: OwnerAvatarStackProps) => {
  const visible = owners.slice(0, maxVisibleOwners);
  const overflow = owners.slice(maxVisibleOwners);
  const isVertical = placement === 'vertical';

  return (
    <div
      className={cx(
        'tw:flex tw:flex-wrap tw:items-center tw:gap-2',
        isVertical && 'tw:flex-col tw:items-start',
        className
      )}>
      {visible.map((owner) => (
        <OwnerChip
          avatarSize={avatarSize}
          isCompactView={false}
          key={owner.id}
          owner={owner}
          ownerDisplayName={ownerDisplayName}
        />
      ))}
      {overflow.length > 0 && (
        <PopoverTrigger>
          <button
            className="tw:text-xs tw:font-medium tw:text-secondary hover:tw:text-primary tw:tabular-nums"
            type="button">
            +{overflow.length}
          </button>
          <Popover containerClassName="tw:p-3 tw:flex tw:flex-col tw:gap-2 tw:min-w-40">
            {overflow.map((owner) => (
              <OwnerChip
                avatarSize={avatarSize}
                isCompactView={false}
                key={owner.id}
                owner={owner}
                ownerDisplayName={ownerDisplayName}
              />
            ))}
          </Popover>
        </PopoverTrigger>
      )}
    </div>
  );
};
