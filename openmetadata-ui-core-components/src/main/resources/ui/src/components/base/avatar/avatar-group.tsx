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
import { Teams as TeamsIcon } from '../../../icons/Teams';
import type { ReactNode } from 'react';
import {
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
} from 'react-aria-components';
import { cx } from '@/utils/cx';
import { OwnerOverflowPopoverContent } from '../../application/owner/owner-overflow-popover-content';
import type { RenderOwnerContent } from '../../application/owner/owner.types';
import type { AvatarSize, OwnerRef } from '../../../types';
import { TooltipTrigger } from '../tooltip/tooltip';
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
    const colorTokens = !isTeam ? getAvatarColorTokens(nameStr) : undefined;
    const TeamIcon = owner.icon;

    const avatar = (
      <Avatar
        alt={nameStr}
        className={isTeam ? 'tw:opacity-60' : undefined}
        contrastBorder={!isTeam}
        initials={!isTeam ? getFirstAlphanumeric(nameStr).toUpperCase() : undefined}
        placeholderIcon={isTeam ? (TeamIcon ?? TeamsIcon) : undefined}
        size={resolvedSize}
        style={
          isTeam
            ? {
                backgroundColor: 'var(--tw-color-utility-gray-200)',
              }
            : {
                backgroundColor: colorTokens!.background,
                color: colorTokens!.textColor,
                outlineColor: colorTokens!.border,
              }
        }
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
            // Ascending z-index: each avatar overlaps the previous; +N sits on top
            zIndex: i + 1,
          }}>
          {renderSingleAvatar(owner)}
        </span>
      ))}
      {overflowCount > 0 && (
        <AriaTooltipTrigger closeDelay={200} delay={300}>
          {/* TooltipTrigger (AriaButton) reads FocusableContext set by AriaTooltipTrigger
              — plain <button> does not read that context so hover wiring is silently dropped */}
          <TooltipTrigger
            aria-label={`+${overflowCount} more ${overflowTitleLabel ?? 'owners'}`}
            className="tw:rounded-full tw:bg-transparent tw:p-0"
            style={{
              marginLeft: `-${overlapPx}px`,
              zIndex: visibleOwners.length + 1,
            }}>
            <Avatar
              className="tw:bg-secondary tw:text-secondary"
              contrastBorder
              initials={`+${overflowCount}`}
              size={resolvedSize}
            />
          </TooltipTrigger>
          <AriaTooltip
            className={({ isEntering, isExiting }) =>
              cx(
                'tw:z-50 tw:max-h-96 tw:w-72 tw:overflow-y-auto tw:rounded-xl tw:bg-primary tw:py-2 tw:shadow-lg tw:outline tw:outline-1 tw:outline-secondary tw:will-change-transform',
                isEntering &&
                  'tw:duration-150 tw:ease-out tw:animate-in tw:fade-in',
                isExiting &&
                  'tw:duration-100 tw:ease-in tw:animate-out tw:fade-out'
              )
            }
            offset={8}
            placement="bottom start">
            <OwnerOverflowPopoverContent
              avatarSize={avatarSize}
              overflowTeamsLabel={overflowTeamsLabel}
              overflowTitleLabel={overflowTitleLabel}
              overflowUsersLabel={overflowUsersLabel}
              ownerDisplayName={ownerDisplayName}
              owners={owners}
            />
          </AriaTooltip>
        </AriaTooltipTrigger>
      )}
    </div>
  );
};
