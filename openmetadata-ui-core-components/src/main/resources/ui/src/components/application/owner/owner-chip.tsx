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
import { Users01, User01 } from '@untitledui/icons';
import { cx } from '@/utils/cx';
import { Avatar } from '../../base/avatar/avatar';
import type { AvatarProps } from '../../base/avatar/avatar';
import type { OwnerChipProps } from './owner.types';

const avatarSizeMap: Record<number, AvatarProps['size']> = {
  16: 'xxs',
  18: 'xxs',
  20: 'xs',
  24: 'xs',
  32: 'sm',
  40: 'md',
  48: 'lg',
  56: 'xl',
  64: '2xl',
};

export const OwnerChip = ({
  owner,
  avatarSize = 24,
  isCompactView = true,
  ownerDisplayName,
  className,
}: OwnerChipProps) => {
  const resolvedSize = avatarSizeMap[avatarSize] ?? 'xs';
  const displayName =
    ownerDisplayName?.get(owner.id) ??
    owner.displayName ??
    owner.name ??
    owner.id;
  const isTeam = owner.type === 'team';
  const PlaceholderIcon = isTeam ? Users01 : User01;

  const avatar = (
    <Avatar
      alt={typeof displayName === 'string' ? displayName : owner.name}
      initials={
        typeof displayName === 'string'
          ? displayName.slice(0, 2).toUpperCase()
          : undefined
      }
      placeholderIcon={PlaceholderIcon}
      size={resolvedSize}
    />
  );

  if (!isCompactView) {
    return (
      <span
        className={cx(
          'tw:flex tw:items-center tw:gap-1.5 tw:min-w-0',
          className
        )}>
        {avatar}
        {owner.href ? (
          <a
            className="tw:truncate tw:text-sm tw:font-medium tw:text-primary hover:tw:underline"
            href={owner.href}
            rel="noreferrer"
            target="_blank">
            {displayName}
          </a>
        ) : (
          <span className="tw:truncate tw:text-sm tw:font-medium tw:text-primary">
            {displayName}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className={cx('tw:flex tw:items-center tw:gap-1 tw:min-w-0', className)}
      title={typeof displayName === 'string' ? displayName : owner.name}>
      {avatar}
    </span>
  );
};
