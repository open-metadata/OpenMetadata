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
import { forwardRef, type HTMLAttributes } from 'react';
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

export const OwnerChip = forwardRef<
  HTMLSpanElement,
  OwnerChipProps & HTMLAttributes<HTMLSpanElement>
>(
  (
    {
      owner,
      avatarSize = 24,
      isCompactView = true,
      ownerDisplayName,
      className,
      // A hover-card wrapper (antd Popover) clones this chip and injects
      // onMouseEnter/onFocus/etc.; spread them onto the root span so the
      // owner hover card actually opens.
      ...rest
    },
    ref
  ) => {
    const resolvedSize = avatarSizeMap[avatarSize] ?? 'xs';
    const displayName =
      ownerDisplayName?.get(owner.name ?? '') ??
      owner.displayName ??
      owner.name ??
      owner.id;
    const isTeam = owner.type === 'team';
    const PlaceholderIcon = owner.icon ?? (isTeam ? TeamsIcon : User01);
    const nameStr =
      typeof displayName === 'string' ? displayName : owner.name ?? '';
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
      // The owner name carries its own data-testid nested inside the `owner-link`
      // wrapper so tests can target either the link (`owner-link`) or the owner by
      // name, and `owner-link` → name chains both resolve.
      //
      // No `title` attribute: the pre-refactor owner display never set one, and a
      // `title=displayName` collides with `getByTitle()` selectors used to pick an
      // owner inside filter dropdowns (case-insensitive substring match), breaking
      // Lineage/Impact-analysis owner-filter tests. The accessible name is carried
      // by the avatar's `alt` and the surrounding UserPopOverCard hover card.
      const nameNode = <span data-testid={nameStr}>{displayName}</span>;

      return (
        <span
          {...rest}
          className={cx(
            'tw:flex tw:items-center tw:gap-1.5 tw:min-w-0',
            className
          )}
          ref={ref}>
          {avatar}
          {owner.href ? (
            <a
              className="tw:truncate tw:text-sm tw:text-primary hover:tw:underline"
              data-testid="owner-link"
              href={owner.href}>
              {nameNode}
            </a>
          ) : (
            <span
              className="tw:truncate tw:text-sm tw:text-primary"
              data-testid="owner-link">
              {nameNode}
            </span>
          )}
        </span>
      );
    }

    return (
      <span
        {...rest}
        className={cx('tw:flex tw:items-center tw:gap-1 tw:min-w-0', className)}
        data-testid={nameStr}
        ref={ref}>
        {avatar}
      </span>
    );
  }
);

OwnerChip.displayName = 'OwnerChip';
