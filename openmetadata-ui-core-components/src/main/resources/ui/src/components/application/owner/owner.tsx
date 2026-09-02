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
import { Edit01 } from '@untitledui/icons';
import { cx } from '@/utils/cx';
import { Popover, PopoverTrigger } from '../popover/popover';
import { OwnerAvatarStack } from './owner-avatar-stack';
import { OwnerChip } from './owner-chip';
import type { OwnerProps } from './owner.types';

/**
 * Unified Owner display and edit component.
 *
 * Display mode: pass `owners` only.
 * Editable mode: also pass `hasPermission` and `selectorContent` (a pre-configured
 * UserTeamSelectableList from the consuming app that handles data-fetching).
 */
export const Owner = ({
  owners = [],
  isCompactView = true,
  maxVisibleOwners = 3,
  avatarSize = 24,
  showLabel = true,
  showDashPlaceholder = false,
  placeHolder,
  placement,
  ownerDisplayName,
  className,
  ownerLabelClassName,
  isAssignee = false,
  hasPermission,
  selectorContent,
  onEditClick,
  'data-testid': dataTestId = 'owner-label',
}: OwnerProps) => {
  if (owners.length === 0) {
    if (showDashPlaceholder) {
      return (
        <span
          className={cx('tw:text-tertiary', className)}
          data-testid={dataTestId}>
          —
        </span>
      );
    }

    return (
      <div
        className={cx('tw:flex tw:items-center tw:gap-1', className)}
        data-testid={dataTestId}>
        {hasPermission && selectorContent ? (
          selectorContent
        ) : (
          <span className="tw:text-tertiary tw:text-sm">
            {placeHolder ?? 'No owners'}
          </span>
        )}
      </div>
    );
  }

  // Non-compact: column with label header above an avatar stack
  if (!isCompactView) {
    return (
      <div
        className={cx(
          'tw:flex tw:flex-col tw:items-start tw:gap-0',
          className
        )}
        data-testid={dataTestId}>
        {(showLabel || selectorContent) && (
          <div className="tw:flex tw:items-center tw:mb-2 tw:gap-2">
            {showLabel && (
              <span className="tw:text-sm tw:font-medium tw:text-brand-700">
                {placeHolder ?? 'Owners'}
              </span>
            )}
            {selectorContent}
          </div>
        )}
        <div className="tw:flex tw:items-center tw:gap-2">
          <OwnerAvatarStack
            avatarSize={avatarSize}
            className={ownerLabelClassName}
            maxVisibleOwners={maxVisibleOwners}
            ownerDisplayName={ownerDisplayName}
            owners={owners}
            placement={placement}
          />
          {isAssignee && hasPermission && onEditClick && (
            <button
              aria-label="Edit assignees"
              className="tw:flex tw:items-center tw:text-secondary hover:tw:text-primary"
              type="button"
              onClick={onEditClick}>
              <Edit01 className="tw:size-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Compact: inline row of owner chips + selector trigger
  const visibleOwners = owners.slice(0, maxVisibleOwners);
  const overflowOwners = owners.slice(maxVisibleOwners);

  return (
    <div
      className={cx('tw:flex tw:items-center tw:gap-2 tw:max-w-full', className)}
      data-testid={dataTestId}>
      <div className="tw:flex tw:items-center tw:flex-wrap tw:gap-1 tw:max-w-full">
        {visibleOwners.map((owner) => (
          <OwnerChip
            avatarSize={avatarSize}
            className={ownerLabelClassName}
            isCompactView
            key={owner.id}
            owner={owner}
            ownerDisplayName={ownerDisplayName}
          />
        ))}
        {overflowOwners.length > 0 && (
          <PopoverTrigger>
            <button
              className="tw:text-xs tw:font-medium tw:text-secondary hover:tw:text-primary tw:tabular-nums"
              type="button">
              +{overflowOwners.length}
            </button>
            <Popover containerClassName="tw:p-3 tw:flex tw:flex-col tw:gap-2 tw:min-w-40">
              {overflowOwners.map((owner) => (
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
      {selectorContent}
    </div>
  );
};
