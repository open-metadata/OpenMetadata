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
import { borderAfter } from '@openmetadata/ui-core-components';
import classNames from 'classnames';

/**
 * The owner filter needs antd's Popover, which clones its child and attaches
 * `onClick` — a prop react-aria's `Button` filters out — so that trigger has to
 * stay a plain element and cannot be a `FilterSelect`. These classes reproduce
 * what `FilterSelect` renders for a `bordered` `triggerVariant="button"` (core
 * `Button`, `secondary`, size `md`), so the owner chip carries the same pill
 * treatment as the FilterSelect chips beside it.
 */
export const chipTriggerClassName = classNames(
  'tw:inline-flex tw:h-max tw:cursor-pointer tw:items-center tw:justify-center',
  'tw:gap-1 tw:whitespace-nowrap tw:rounded-lg tw:bg-surface tw:px-3.5 tw:py-2.5',
  'tw:text-sm tw:font-medium tw:text-secondary tw:shadow-xs-skeuomorphic',
  'tw:relative tw:outline-brand tw:transition tw:duration-100 tw:ease-linear',
  borderAfter,
  'tw:after:outline-primary',
  'tw:hover:bg-primary_hover tw:dark:hover:bg-raised tw:hover:text-secondary_hover'
);

/** Brand treatment the FilterSelect trigger takes on once a value is picked. */
export const chipTriggerSelectedClassName = classNames(
  'tw:text-fg-brand-primary tw:hover:text-fg-brand-primary',
  'tw:after:outline-brand'
);

/**
 * Chevron colour for a trigger built by hand: `FilterSelect` brands its trigger
 * icon on selection, and these two utilities are the same Tailwind group, so the
 * state has to pick one rather than stack both.
 */
export const chipChevronClassName = (hasSelection: boolean) =>
  classNames(
    'tw:size-5 tw:shrink-0',
    hasSelection ? 'tw:text-fg-brand-primary' : 'tw:text-fg-quaternary'
  );

/** Matches the count badge `FilterSelect` renders on its own trigger. */
export const chipCountBadgeClassName = classNames(
  'tw:ml-1.5 tw:inline-flex tw:h-[18px] tw:min-w-[18px] tw:shrink-0',
  'tw:items-center tw:justify-center tw:rounded-full tw:bg-utility-brand-50',
  'tw:px-[5px] tw:text-xs tw:font-medium tw:text-utility-brand-700 tw:tabular-nums'
);
