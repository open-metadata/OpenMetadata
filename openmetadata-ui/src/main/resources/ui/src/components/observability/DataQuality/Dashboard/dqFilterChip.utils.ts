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
import classNames from 'classnames';

/**
 * The owner filter needs antd's Popover, which clones its child and attaches
 * `onClick` — a prop react-aria's `Button` filters out — so that trigger has to
 * stay a plain element and cannot be a `FilterSelect`. These classes reproduce
 * what `FilterSelect` renders for `triggerVariant="button"` without `bordered`
 * (core `Button`, `tertiary`, size `sm`, with the quick-filter padding), so the
 * owner chip sits flush beside the FilterSelect chips instead of carrying the
 * heavier bordered treatment.
 */
export const chipTriggerClassName = classNames(
  'tw:group tw:relative tw:inline-flex tw:h-max tw:cursor-pointer tw:items-center',
  'tw:justify-center tw:gap-1 tw:whitespace-nowrap tw:rounded-lg tw:p-1',
  'tw:text-sm tw:font-medium tw:outline-brand tw:transition tw:duration-100 tw:ease-linear',
  'tw:text-tertiary tw:hover:bg-primary_hover tw:hover:text-tertiary_hover',
  'tw:*:data-icon:size-3.5 tw:*:data-icon:text-fg-quaternary'
);

/** Brand treatment the FilterSelect trigger takes on once a value is picked. */
export const chipTriggerSelectedClassName =
  'tw:text-fg-brand-primary tw:hover:text-fg-brand-primary';

/** Matches the count badge `FilterSelect` renders on its own trigger. */
export const chipCountBadgeClassName = classNames(
  'tw:ml-1.5 tw:inline-flex tw:h-[18px] tw:min-w-[18px] tw:shrink-0',
  'tw:items-center tw:justify-center tw:rounded-full tw:bg-utility-brand-50',
  'tw:px-[5px] tw:text-xs tw:font-medium tw:text-utility-brand-700 tw:tabular-nums'
);
