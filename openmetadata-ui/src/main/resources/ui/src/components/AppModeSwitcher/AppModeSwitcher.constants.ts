/*
 *  Copyright 2026 Collate.
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

import {
  AppModeSwitcherTriggerStyle,
  AppModeSwitcherVariant,
} from './AppModeSwitcher.types';

export const OPTION_ICON_BOX =
  'tw:w-9 tw:h-9 tw:rounded-[10px] tw:bg-utility-blue-50 tw:border tw:border-utility-blue-100 tw:shrink-0';

export const CURRENT_CHECK_CLASS = 'tw:shrink-0 tw:text-fg-brand-primary';

const UNSTYLED_BUTTON =
  'tw:flex tw:items-center tw:bg-transparent tw:border-0 tw:cursor-pointer';

// `frame` variants sit inside a core Card, which owns the surface (border, background, radius).
export const TRIGGER_STYLES: Record<
  AppModeSwitcherVariant,
  AppModeSwitcherTriggerStyle
> = {
  inline: {
    root: `${UNSTYLED_BUTTON} tw:gap-2.5 tw:w-full tw:p-0 tw:text-left`,
    label: 'tw:flex-1 tw:text-sm tw:text-secondary tw:font-medium',
    iconSize: 20,
    chevron: 'right',
  },
  pill: {
    root: 'tw:flex tw:items-center tw:gap-1 tw:px-2 tw:py-1 tw:bg-utility-blue-50 tw:border tw:border-utility-blue-200 tw:rounded-full tw:cursor-pointer tw:text-left',
    label: 'tw:text-[10px] tw:text-utility-blue-700 tw:font-semibold',
    iconSize: 12,
    chevron: 'up',
  },
  card: {
    root: `${UNSTYLED_BUTTON} tw:gap-2.5 tw:w-full tw:px-3.5 tw:py-2.5 tw:text-left tw:hover:bg-primary_hover`,
    label: 'tw:flex-1 tw:text-sm tw:text-primary tw:font-medium',
    iconSize: 20,
    chevron: 'right',
    frame: 'tw:w-full',
  },
  icon: {
    root: `${UNSTYLED_BUTTON} tw:justify-center tw:size-full tw:hover:bg-primary_hover`,
    iconSize: 20,
    frame: 'tw:size-14',
  },
};
