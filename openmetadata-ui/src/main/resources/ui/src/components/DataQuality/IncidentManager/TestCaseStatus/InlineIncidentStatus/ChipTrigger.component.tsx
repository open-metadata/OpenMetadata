/*
 *  Copyright 2023 Collate.
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

import { Button } from '@openmetadata/ui-core-components';
import {
  ChevronDown as ArrowDownIcon,
  ChevronUp as ArrowUpIcon,
} from '@untitledui/icons';
import { type RefObject } from 'react';

export type ChipPalette = {
  bg: string;
  color: string;
  border: string;
};

export type ChipTriggerProps = {
  chipRef: RefObject<HTMLButtonElement | null>;
  dataTestId: string;
  chipLabel: string;
  palette: ChipPalette;
  hasEditPermission: boolean;
  overlayOpen: boolean;
  attachPressHandler: boolean;
  /**
   * Bound the label's width so it cannot widen the column it sits in. Opt-in per
   * call site, because the safe cap differs by column — see CHIP_LABEL_MAX_WIDTH.
   */
  truncateLabel?: boolean;
  onStatusClick?: () => void;
};

const CHIP_TRIGGER_BTN_CLASS =
  'tw:inline-flex tw:h-auto tw:min-h-0 tw:p-0 tw:shadow-none tw:after:outline-0 tw:bg-transparent hover:tw:bg-transparent tw:outline-none';

const CHIP_PILL_CLASS =
  'tw:inline-flex tw:items-center tw:gap-0.5 tw:whitespace-nowrap tw:rounded-full tw:border tw:px-2 tw:py-1 tw:text-xs tw:font-medium tw:leading-none';

// A chip in an auto-layout table cell contributes its intrinsic width as the
// column's floor, so an unbounded nowrap label lets a long translation widen the
// column until the table outgrows its container and the trailing columns are
// pushed off screen (issue #30522).
//
// 11rem is a severity-column budget, not a chip-wide one, and the two cannot be
// reconciled — which is why this is opt-in rather than baked into the pill:
//   - severity must stay <= ~176px or ru-RU "Критичность инцидента отсутствует"
//     (254px unbounded) pushes the Assignee column past the viewport;
//   - the widest *status* pill already renders 172.7px (ru-RU "Назначен
//     исполнитель"), so a cap that is safe for status needs >= ~192px, which
//     re-inflates the severity column by 16px and reinstates the bug.
// Status therefore stays unbounded and can never truncate by construction.
// All widths measured in-DOM at 12px/500 Inter across the 20 shipped locales; an
// off-DOM probe under-reports Cyrillic by ~6px because the `unicode-range`
// subset is not active for it.
const CHIP_LABEL_MAX_WIDTH = 'tw:max-w-44';

export const ChipTrigger = ({
  chipRef,
  dataTestId,
  chipLabel,
  palette,
  hasEditPermission,
  overlayOpen,
  attachPressHandler,
  truncateLabel = false,
  onStatusClick = () => {},
}: ChipTriggerProps) => {
  const ChevronIcon = overlayOpen ? ArrowUpIcon : ArrowDownIcon;
  const pillWidthClass = truncateLabel ? CHIP_LABEL_MAX_WIDTH : 'tw:max-w-max';

  return (
    <Button
      noTextPadding
      className={CHIP_TRIGGER_BTN_CLASS}
      color="tertiary"
      data-testid={dataTestId}
      isDisabled={!hasEditPermission}
      ref={chipRef}
      size="sm"
      {...(attachPressHandler && hasEditPermission
        ? { onPress: onStatusClick }
        : {})}>
      <span
        className={`${CHIP_PILL_CLASS} ${pillWidthClass} tw:bg-[var(--chip-bg)] tw:text-[var(--chip-color)] tw:border-[var(--chip-border)]`}
        data-testid={`${dataTestId}-pill`}
        style={{
          backgroundColor: palette.bg,
          borderColor: palette.border,
          color: palette.color,
        }}>
        {/* Truncation is visual only — the full label stays in the DOM for the
            button's accessible name, and `title` surfaces it on hover. */}
        <span
          className="tw:min-w-0 tw:truncate"
          data-testid={`${dataTestId}-label`}
          title={chipLabel}>
          {chipLabel}
        </span>
        {hasEditPermission && (
          <ChevronIcon
            aria-hidden
            className="tw:size-4 tw:shrink-0 tw:text-[var(--chip-color)]"
          />
        )}
      </span>
    </Button>
  );
};
