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
import classNames from 'classnames';
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
   * Tailwind max-width utility bounding **the whole pill**, e.g. `tw:max-w-44`.
   * Omit and the chip sizes to its content, as it always has.
   *
   * This is not the label's budget. The class lands on the pill, which also
   * carries 16px of horizontal padding, 2px of border, a 2px gap and a 16px
   * chevron — 36px of chrome when the user may edit, 20px when they may not. So
   * `tw:max-w-44` (176px) leaves the label 140px, and the button that wraps the
   * pill measures 180px. Size this from a measured *text* width only after
   * adding that chrome back, or the chip will clip ~36px sooner than intended.
   *
   * A chip in an auto-layout table cell contributes its intrinsic width as the
   * column's floor, so an unbounded nowrap label lets a long translation widen
   * the column until the table outgrows its container and the trailing columns
   * are pushed off screen (issue #30522).
   *
   * The bound is passed in rather than fixed here because the safe value is a
   * property of the *column*, not of the chip. It is opt-in rather than shared
   * for two reasons:
   *   - the severity column needs <= 184px (measured at 1440px with the nav
   *     expanded: 184px keeps the Assignee column on screen, 188px does not),
   *     while the widest status pill already renders 172.7px in ru-RU — so a
   *     shared cap would have to sit in the narrow [173, 184] band, and
   *     Tailwind's scale offers only `max-w-44` (176px) inside it, with
   *     `max-w-48` (192px) well outside;
   *   - a shared 176px cap would leave status just 3.3px of headroom, so any
   *     retranslation or typography-token change would silently truncate the
   *     Incident Manager's primary column. Opt-in leaves status unbounded, which
   *     no measurement can invalidate.
   */
  maxChipWidth?: string;
  onStatusClick?: () => void;
};

const CHIP_TRIGGER_BTN_CLASS =
  'tw:inline-flex tw:h-auto tw:min-h-0 tw:p-0 tw:shadow-none tw:after:outline-0 tw:bg-transparent hover:tw:bg-transparent tw:outline-none';

const CHIP_PILL_CLASS =
  'tw:inline-flex tw:items-center tw:gap-0.5 tw:whitespace-nowrap tw:rounded-full tw:border tw:px-2 tw:py-1 tw:text-xs tw:font-medium tw:leading-none';

const CHIP_PILL_PALETTE_CLASS =
  'tw:bg-[var(--chip-bg)] tw:text-[var(--chip-color)] tw:border-[var(--chip-border)]';

export const ChipTrigger = ({
  chipRef,
  dataTestId,
  chipLabel,
  palette,
  hasEditPermission,
  overlayOpen,
  attachPressHandler,
  maxChipWidth,
  onStatusClick = () => {},
}: ChipTriggerProps) => {
  const ChevronIcon = overlayOpen ? ArrowUpIcon : ArrowDownIcon;
  const isBounded = Boolean(maxChipWidth);

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
        className={classNames(
          CHIP_PILL_CLASS,
          CHIP_PILL_PALETTE_CLASS,
          maxChipWidth ?? 'tw:max-w-max'
        )}
        style={{
          backgroundColor: palette.bg,
          borderColor: palette.border,
          color: palette.color,
        }}>
        {/* Truncation is visual only — the full label stays in the DOM for the
            button's accessible name, and `title` surfaces it on hover. Both are
            gated on the bound: an unbounded chip cannot clip, so a tooltip there
            would only repeat text the user can already read. */}
        <span
          className={isBounded ? 'tw:min-w-0 tw:truncate' : undefined}
          data-testid={`${dataTestId}-label`}
          title={isBounded ? chipLabel : undefined}>
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
