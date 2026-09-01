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
import { User01, Users01 } from '@untitledui/icons';
import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';
import { Popover, PopoverTrigger } from '../../application/popover/popover';
import { OwnerOverflowPopoverContent } from '../../application/owner/owner-overflow-popover-content';
import type { RenderOwnerContent } from '../../application/owner/owner.types';
import type { AvatarSize, OwnerRef } from '../../../types';
import { getAvatarColorTokens, getFirstAlphanumeric } from './utils';
import type { AvatarProps } from './avatar';
import { Avatar } from './avatar';

// Maps numeric pixel size to Avatar size string
const groupAvatarSizeMap: Record<number, AvatarProps['size']> = {
  16: 'xxs',
  18: 'xxs',
  20: 'xs',
  24: 'xs',
  28: 'xs',
  32: 'sm',
  36: 'sm',
  40: 'md',
  48: 'lg',
  56: 'xl',
  64: '2xl',
};

export interface AvatarGroupProps {
  owners: OwnerRef[];
  /** Max avatars shown before collapsing to +N. Default 3. */
  maxCount?: number;
  /** Avatar pixel size (16–64). Default 24. */
  avatarSize?: AvatarSize;
  className?: string;
  ownerDisplayName?: Map<string, ReactNode>;
  renderOwnerContent?: RenderOwnerContent;
  overflowTitleLabel?: string;
  overflowTeamsLabel?: string;
  overflowUsersLabel?: string;
}

export const AvatarGroup = ({
  owners,
  maxCount = 3,
  avatarSize = 24,
  className,
  ownerDisplayName,
  renderOwnerContent,
  overflowTitleLabel,
  overflowTeamsLabel,
  overflowUsersLabel,
}: AvatarGroupProps) => {
  const resolvedSize = groupAvatarSizeMap[avatarSize] ?? 'xs';
  const visibleOwners = owners.slice(0, maxCount);
  const overflowCount = Math.max(0, owners.length - maxCount);
  const overlapPx = Math.round(avatarSize / 4);

  const renderSingleAvatar = (owner: OwnerRef) => {
    const rawDisplayName =
      ownerDisplayName?.get(owner.id) ??
      owner.displayName ??
      owner.name ??
      owner.id;
    const nameStr =
      typeof rawDisplayName === 'string'
        ? rawDisplayName
        : (owner.name ?? owner.id);
    const isTeam = owner.type === 'team';
    const colorTokens = getAvatarColorTokens(nameStr);

    const avatar = (
      <Avatar
        alt={nameStr}
        contrastBorder
        placeholder={
          !isTeam ? (
            <span style={{ color: colorTokens.textColor }}>
              {getFirstAlphanumeric(nameStr).toUpperCase()}
            </span>
          ) : undefined
        }
        placeholderIcon={isTeam ? Users01 : User01}
        size={resolvedSize}
        style={{
          backgroundColor: colorTokens.background,
          outlineColor: 'var(--color-bg-primary)',
        }}
      />
    );

    const chip = (
      <span
        className="tw:block"
        key={owner.id}
        title={typeof rawDisplayName === 'string' ? rawDisplayName : owner.name}>
        {avatar}
      </span>
    );

    return renderOwnerContent ? renderOwnerContent(owner, chip) : chip;
  };

  return (
    <div className={cx('tw:flex tw:items-center', className)}>
      {visibleOwners.map((owner, i) => (
        <span
          className={cx('tw:relative tw:block tw:rounded-full')}
          key={owner.id}
          style={{
            marginLeft: i > 0 ? `-${overlapPx}px` : undefined,
            zIndex: visibleOwners.length - i,
          }}>
          {renderSingleAvatar(owner)}
        </span>
      ))}
      {overflowCount > 0 && (
        <PopoverTrigger>
          <button
            aria-label={`+${overflowCount} more ${overflowTitleLabel ?? 'owners'}`}
            className="tw:relative tw:z-0 tw:block tw:cursor-pointer tw:rounded-full tw:border-0 tw:bg-transparent tw:p-0 hover:tw:z-10"
            style={{ marginLeft: `-${overlapPx}px` }}
            type="button">
            <Avatar
              contrastBorder
              initials={`+${overflowCount}`}
              size={resolvedSize}
              style={{ outlineColor: 'var(--color-bg-primary)' }}
            />
          </button>
          <Popover containerClassName="tw:p-3">
            <OwnerOverflowPopoverContent
              avatarSize={avatarSize}
              overflowTeamsLabel={overflowTeamsLabel}
              overflowTitleLabel={overflowTitleLabel}
              overflowUsersLabel={overflowUsersLabel}
              ownerDisplayName={ownerDisplayName}
              owners={owners}
            />
          </Popover>
        </PopoverTrigger>
      )}
    </div>
  );
};
