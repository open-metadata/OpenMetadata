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
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { Owners } from '../../../icons/Owners';
import { Popover, PopoverTrigger } from '../popover/popover';
import { OwnerAvatarStack } from './owner-avatar-stack';
import { OwnerChip } from './owner-chip';
import { toOwnerRefs } from './owner-utils';
import type { OwnerProps } from './owner.types';

/**
 * Unified Owner display and edit component.
 *
 * Display mode: pass `owners` only — raw owner refs (e.g. the app's
 * EntityReference) are accepted and normalised internally; the profile href and
 * hover card come from the app-registered resolvers (see owner-renderer.ts), so
 * call sites don't wrap the array.
 * Editable mode: also pass `hasPermission` and `selectorContent` (a pre-configured
 * UserTeamSelectableList from the consuming app that handles data-fetching).
 */
export const Owner = ({
  owners: ownersInput = [],
  isCompactView = true,
  maxVisibleOwners = 3,
  avatarSize = 24,
  showLabel = true,
  showDashPlaceholder = false,
  placeHolder,
  ownerDisplayName,
  className,
  hasPermission,
  selectorContent,
  'data-testid': dataTestId = 'owner-label',
}: OwnerProps) => {
  const { t } = useCoreTranslation();

  // Normalise raw refs (EntityReference-like) to OwnerEntityReference once so every branch
  // below and the child components receive the library's owner shape.
  const owners = toOwnerRefs(ownersInput);

  // Inline editable mode: a non-compact owner with an edit selector but no label
  // (e.g. the Incident Manager assignee cell). The column layout stacks the
  // selector above the owner; this renders owner + selector on a single row so
  // the edit control sits beside the owner, matching the pre-unification look.
  const isInlineWithSelector = !showLabel && Boolean(selectorContent);

  if (owners.length === 0) {
    if (!isCompactView && isInlineWithSelector) {
      return (
        <div
          className={cx('tw:flex tw:items-center tw:gap-1', className)}
          data-testid={dataTestId}>
          {!showDashPlaceholder && (
            <Owners
              className="tw:size-4 tw:shrink-0 tw:text-quaternary"
              data-testid="no-owner-icon"
            />
          )}
          <span className="tw:text-quaternary tw:text-xs">
            {showDashPlaceholder ? '--' : placeHolder ?? t('label.no-owners')}
          </span>
          {selectorContent}
        </div>
      );
    }

    // Non-compact: always render the full column layout so the label + edit button are visible
    if (!isCompactView) {
      const hasLabelRow = showLabel || Boolean(selectorContent);

      return (
        <div
          className={cx(
            'tw:flex tw:flex-col tw:items-start tw:gap-0',
            className
          )}
          data-testid={dataTestId}>
          {hasLabelRow && (
            <div className="tw:flex tw:items-center tw:mb-2 tw:gap-2">
              {showLabel && (
                <span className="tw:text-sm tw:font-medium tw:text-secondary">
                  {placeHolder ?? t('label.owners')}
                </span>
              )}
              {selectorContent}
            </div>
          )}
          <span className="tw:text-quaternary tw:text-xs">
            {showDashPlaceholder ? '--' : placeHolder ?? t('label.no-owners')}
          </span>
        </div>
      );
    }

    if (hasPermission && selectorContent) {
      return (
        <div
          className={cx('tw:flex tw:items-center tw:gap-1', className)}
          data-testid={dataTestId}>
          {selectorContent}
        </div>
      );
    }

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
        {/* Matches the legacy NoOwnerFound placeholder: a user glyph the app
            asserts on (data-testid="no-owner-icon") for the empty compact state. */}
        <Owners
          className="tw:size-4 tw:shrink-0 tw:text-quaternary"
          data-testid="no-owner-icon"
        />
        <span className="tw:text-quaternary tw:text-xs">
          {placeHolder ?? t('label.no-owners')}
        </span>
      </div>
    );
  }

  // Inline editable mode: owner avatar(s) + name with the edit selector beside
  // them on a single row (see isInlineWithSelector above).
  if (!isCompactView && isInlineWithSelector) {
    return (
      <div
        className={cx('tw:flex tw:items-center tw:gap-2', className)}
        data-testid={dataTestId}>
        <OwnerAvatarStack
          avatarSize={avatarSize}
          maxVisibleOwners={maxVisibleOwners}
          ownerDisplayName={ownerDisplayName}
          owners={owners}
        />
        {selectorContent}
      </div>
    );
  }

  // Non-compact: column with label header above an avatar stack
  if (!isCompactView) {
    return (
      <div
        className={cx('tw:flex tw:flex-col tw:items-start tw:gap-0', className)}
        data-testid={dataTestId}>
        {(showLabel || selectorContent) && (
          <div className="tw:flex tw:items-center tw:mb-2 tw:gap-2">
            {showLabel && (
              <span className="tw:text-sm tw:font-medium tw:text-secondary">
                {placeHolder ?? t('label.owners')}
              </span>
            )}
            {selectorContent}
          </div>
        )}
        <div className="tw:flex tw:items-center tw:gap-2">
          <OwnerAvatarStack
            avatarSize={avatarSize}
            maxVisibleOwners={maxVisibleOwners}
            ownerDisplayName={ownerDisplayName}
            owners={owners}
          />
        </div>
      </div>
    );
  }

  // Compact: inline row of owner chips + selector trigger
  const visibleOwners = owners.slice(0, maxVisibleOwners);
  const overflowOwners = owners.slice(maxVisibleOwners);

  return (
    <div
      className={cx(
        'tw:flex tw:items-center tw:gap-2 tw:max-w-full',
        className
      )}
      data-testid={dataTestId}>
      <div className="tw:flex tw:items-center tw:flex-wrap tw:gap-1 tw:max-w-full">
        {visibleOwners.map((owner, i) => (
          <OwnerChip
            isCompactView
            avatarSize={avatarSize}
            key={owner.id || owner.name || String(i)}
            owner={owner}
            ownerDisplayName={ownerDisplayName}
          />
        ))}
        {overflowOwners.length > 0 && (
          <PopoverTrigger>
            <button
              className="tw:text-xs tw:font-medium tw:text-secondary tw:hover:text-primary tw:tabular-nums"
              type="button">
              +{overflowOwners.length}
            </button>
            <Popover containerClassName="tw:p-3 tw:flex tw:flex-col tw:gap-2 tw:min-w-40">
              {overflowOwners.map((owner, i) => (
                <OwnerChip
                  avatarSize={avatarSize}
                  isCompactView={false}
                  key={owner.id || owner.name || String(i)}
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
