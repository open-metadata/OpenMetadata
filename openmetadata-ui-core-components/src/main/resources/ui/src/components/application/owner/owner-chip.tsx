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
import { User01 } from '@untitledui/icons';
import { Teams as TeamsIcon } from '../../../icons/Teams';
import { cx } from '@/utils/cx';
import { Avatar } from '../../base/avatar/avatar';
import type { AvatarProps } from '../../base/avatar/avatar';
import type { OwnerChipProps } from './owner.types';

/** Hash a display name to a stable hue in [0, 360). */
const nameToHue = (name: string): number => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return Math.abs(hash) % 360;
};

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
  const PlaceholderIcon = owner.icon ?? (isTeam ? TeamsIcon : User01);
  const nameStr =
    typeof displayName === 'string' ? displayName : (owner.name ?? '');
  const hue = nameToHue(nameStr);
  const avatarStyle = isTeam
    ? {
        backgroundColor: 'var(--tw-color-utility-gray-200)',
      }
    : {
        backgroundColor: `hsl(${hue}, 100%, 92%)`,
        color: `hsl(${hue}, 70%, 40%)`,
      };

  const avatar = (
    <Avatar
      alt={typeof displayName === 'string' ? displayName : owner.name}
      className={isTeam ? 'tw:opacity-60' : undefined}
      contrastBorder={!isTeam}
      initials={
        typeof displayName === 'string' && !isTeam
          ? displayName.slice(0, 1).toUpperCase()
          : undefined
      }
      placeholderIcon={PlaceholderIcon}
      size={resolvedSize}
      src={owner.profileUrl}
      style={avatarStyle}
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
            className="tw:truncate tw:text-sm tw:text-primary hover:tw:underline"
            href={owner.href}>
            {displayName}
          </a>
        ) : (
          <span className="tw:truncate tw:text-sm tw:text-primary">
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
