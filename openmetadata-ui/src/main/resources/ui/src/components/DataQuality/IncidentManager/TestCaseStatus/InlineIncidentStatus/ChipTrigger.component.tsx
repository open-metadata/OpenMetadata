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
  onStatusClick?: () => void;
};

const CHIP_TRIGGER_BTN_CLASS =
  'tw:inline-flex tw:h-auto tw:min-h-0 tw:p-0 tw:shadow-none tw:ring-0 tw:bg-transparent hover:tw:bg-transparent tw:outline-none';

const CHIP_PILL_CLASS =
  'tw:inline-flex tw:max-w-max tw:items-center tw:gap-0.5 tw:whitespace-nowrap tw:rounded-full tw:border tw:px-2 tw:py-1 tw:text-xs tw:font-medium tw:leading-none';

export const ChipTrigger = ({
  chipRef,
  dataTestId,
  chipLabel,
  palette,
  hasEditPermission,
  overlayOpen,
  attachPressHandler,
  onStatusClick = () => {},
}: ChipTriggerProps) => {
  const ChevronIcon = overlayOpen ? ArrowUpIcon : ArrowDownIcon;

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
        className={`${CHIP_PILL_CLASS} tw:bg-[var(--chip-bg)] tw:text-[var(--chip-color)] tw:border-[var(--chip-border)]`}
        style={{
          backgroundColor: palette.bg,
          borderColor: palette.border,
          color: palette.color,
        }}>
        {chipLabel}
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
