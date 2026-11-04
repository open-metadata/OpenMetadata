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
 * The design's segmented view switch, laid over core's ButtonGroup: a
 * borderless gray track with the chosen view raised on it. The joined-edge
 * group look is undone so the options sit apart on the track.
 *
 * `bg-raised` keeps the chosen view lighter than the track in dark mode too,
 * where `bg-tertiary` is gray-800.
 */
// ADR:2026-10-23-landing-page-segmented-controls-are-styled-at-the-call-site
export const SEGMENTED_GROUP_CLASSES =
  'tw:gap-1 tw:space-x-0 tw:rounded-[10px] tw:bg-tertiary tw:p-1 tw:shadow-none';

export const getSegmentedItemClasses = (isSelected: boolean) =>
  classNames(
    'tw:rounded-lg tw:px-3 tw:py-1.5 tw:shadow-none tw:first:rounded-lg tw:last:rounded-lg tw:not-last:pr-3',
    isSelected
      ? 'tw:bg-raised tw:text-primary tw:shadow-xs tw:after:outline-secondary tw:hover:bg-raised tw:selected:bg-raised tw:selected:text-primary'
      : 'tw:bg-transparent tw:text-tertiary tw:after:outline-transparent tw:hover:bg-transparent tw:hover:text-secondary'
  );
