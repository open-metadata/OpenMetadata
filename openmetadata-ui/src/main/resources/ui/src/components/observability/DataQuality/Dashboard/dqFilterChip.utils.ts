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

// Mirrors the core `Button` `secondary`/`md` look so the owner trigger (a plain
// element required by antd's Popover) matches the react-aria Button chips.
export const chipTriggerClassName = classNames(
  'tw:inline-flex tw:h-max tw:cursor-pointer tw:items-center tw:justify-center',
  'tw:gap-1 tw:whitespace-nowrap tw:rounded-lg tw:bg-primary tw:px-3.5 tw:py-2.5',
  'tw:text-sm tw:font-medium tw:text-secondary tw:shadow-xs-skeuomorphic',
  'tw:relative tw:outline-brand tw:transition',
  borderAfter,
  'tw:after:outline-primary',
  'tw:duration-100 tw:ease-linear tw:hover:bg-primary_hover tw:hover:text-secondary_hover'
);

export const chipLabel = (label: string, count: number) =>
  count > 0 ? `${label} · ${count}` : label;
