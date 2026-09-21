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

/**
 * Trigger parts shared by FilterSelect and TreeSelect.
 *
 * They live here rather than in `filter-select.tsx` because that module imports
 * `TreeSelect` for the `FilterSelect.Tree` compound. Importing them from there
 * closes a cycle, and the bundler then emits `FilterSelect.Tree = TreeSelect`
 * ahead of the `TreeSelect` declaration — a temporal-dead-zone ReferenceError
 * that blanks the page at import time.
 */
import { SearchLg } from '@untitledui/icons';
import type { HTMLAttributes } from 'react';
import { Typography } from '@/components/foundations/typography';
// Narrow wrapper so the icon prop's type doesn't widen to the raw
// `@untitledui/icons` FC, whose `children` type clashes with consumers that
// augment ReactNode globally (e.g. react-i18next).
export const SearchInputIcon = (props: HTMLAttributes<HTMLOrSVGElement>) => (
  <SearchLg aria-hidden="true" {...props} />
);

export const TriggerCountBadge = ({ count }: { count: number }) => (
  <Typography
    className="tw:ml-1.5 tw:inline-flex tw:h-[18px] tw:min-w-[18px] tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-utility-brand-50 tw:px-[5px] tw:tabular-nums tw:text-fg-brand-primary"
    data-testid="filter-count-badge"
    size="text-xs"
    weight="medium">
    {count}
  </Typography>
);
