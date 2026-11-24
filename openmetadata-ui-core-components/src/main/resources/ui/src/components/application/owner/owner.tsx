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
import { User01 } from '../../../icons/User01';
import { Typography } from '../../foundations/typography';
import { Popover, PopoverTrigger } from '../popover/popover';
import { OwnerAvatarStack } from './owner-avatar-stack';
import { OwnerChip } from './owner-chip';
import { toOwnerRefs } from './owner-utils';
import type { OwnerLabelVariant, OwnerProps } from './owner.types';

const EMPTY_OWNERS_TEXT = '--';

// `header` is the type of the other page-header values (Domains, Tier,
// Email…); `cell` is a table row's body size in the subtle tone. Typography's
// `color` prop has no quaternary or `text-secondary`, so those stay classes.
const LABEL_VARIANT_STYLES: Record<
  OwnerLabelVariant,
  { size: 'text-xs' | 'text-sm'; weight: 'regular' | 'medium'; color: string }
> = {
  header: { size: 'text-sm', weight: 'medium', color: 'tw:text-secondary' },
  cell: { size: 'text-sm', weight: 'regular', color: 'tw:text-quaternary' },
  subtle: { size: 'text-xs', weight: 'regular', color: 'tw:text-quaternary' },
};

const OwnerEmptyPlaceholder = ({
  text,
  variant,
}: {
  text: string;
  variant: OwnerLabelVariant;
}) => (
  <Typography
    as="span"
    className={LABEL_VARIANT_STYLES[variant].color}
    data-testid="owner-empty-placeholder"
    size={LABEL_VARIANT_STYLES[variant].size}
    weight={LABEL_VARIANT_STYLES[variant].weight}>
    {text}
  </Typography>
);

const NoOwnerIcon = () => (
  <User01
    className="tw:size-4 tw:shrink-0 tw:text-quaternary"
    data-testid="no-owner-icon"
  />
);

/**
 * Unified Owner display and edit component.
 *
 * Display mode: pass `owners` only — raw owner refs (e.g. the app's
 * EntityReference) are accepted and normalised internally; the profile href and
 * hover card come from the app-registered resolvers (see owner-renderer.ts), so
 * call sites don't wrap the array.
 * Editable mode: also pass `hasPermission` and `selectorContent` (a pre-configured
 * UserTeamSelectableList from the consuming app that handles data-fetching).
 *
 * With no owners it shows `--`, the same empty value as the fields beside it,
 * unless the caller names the empty state (`placeHolder`, e.g. "No Assignee").
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
  labelVariant,
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
    // A caller-named empty state (e.g. "No Assignee") replaces `--`; the
    // compact and inline layouts put the user glyph the app asserts on
    // (data-testid="no-owner-icon") before it.
    const namedEmptyText = showDashPlaceholder ? undefined : placeHolder;
    const emptyText = namedEmptyText ?? EMPTY_OWNERS_TEXT;

    if (!isCompactView && isInlineWithSelector) {
      return (
        <div
          className={cx('tw:flex tw:items-center tw:gap-1', className)}
          data-testid={dataTestId}>
          {namedEmptyText && <NoOwnerIcon />}
          <OwnerEmptyPlaceholder
            text={emptyText}
            variant={labelVariant ?? 'subtle'}
          />
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
                <Typography
                  as="span"
                  className="tw:text-secondary"
                  size="text-sm"
                  weight="medium">
                  {placeHolder ?? t('label.owners')}
                </Typography>
              )}
              {selectorContent}
            </div>
          )}
          {/* Under a label, `placeHolder` is that label, not the empty text. */}
          <OwnerEmptyPlaceholder
            text={showLabel ? EMPTY_OWNERS_TEXT : emptyText}
            variant={labelVariant ?? (selectorContent ? 'header' : 'subtle')}
          />
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

    return (
      <div
        className={cx('tw:flex tw:items-center tw:gap-1', className)}
        data-testid={dataTestId}>
        {namedEmptyText && <NoOwnerIcon />}
        <OwnerEmptyPlaceholder
          text={emptyText}
          variant={labelVariant ?? 'subtle'}
        />
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
              <Typography
                as="span"
                className="tw:text-secondary"
                size="text-sm"
                weight="medium">
                {placeHolder ?? t('label.owners')}
              </Typography>
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
