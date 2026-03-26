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

import type { GapValues } from '@/components';

/**
 * Static map of gap values to Tailwind classes.
 * Use this instead of dynamic template literals (e.g. `tw:gap-${gap}`)
 * so that Tailwind's static scanner can detect all variants at build time.
 */
export const gapClassMapping: Record<GapValues, string> = {
  0: 'tw:gap-0',
  1: 'tw:gap-1',
  2: 'tw:gap-2',
  3: 'tw:gap-3',
  4: 'tw:gap-4',
  5: 'tw:gap-5',
  6: 'tw:gap-6',
  7: 'tw:gap-7',
  8: 'tw:gap-8',
  9: 'tw:gap-9',
  10: 'tw:gap-10',
  11: 'tw:gap-11',
  12: 'tw:gap-12',
  14: 'tw:gap-14',
  16: 'tw:gap-16',
  20: 'tw:gap-20',
  24: 'tw:gap-24',
  28: 'tw:gap-28',
  32: 'tw:gap-32',
  36: 'tw:gap-36',
  40: 'tw:gap-40',
  44: 'tw:gap-44',
  48: 'tw:gap-48',
  52: 'tw:gap-52',
  56: 'tw:gap-56',
  60: 'tw:gap-60',
  64: 'tw:gap-64',
  72: 'tw:gap-72',
  80: 'tw:gap-80',
  96: 'tw:gap-96',
};

/**
 * Static map of row gap values to Tailwind classes.
 * Use this instead of dynamic template literals (e.g. `tw:gap-y-${gap}`)
 * so that Tailwind's static scanner can detect all variants at build time.
 */
export const rowGapClassMapping: Record<GapValues, string> = {
  0: 'tw:gap-y-0',
  1: 'tw:gap-y-1',
  2: 'tw:gap-y-2',
  3: 'tw:gap-y-3',
  4: 'tw:gap-y-4',
  5: 'tw:gap-y-5',
  6: 'tw:gap-y-6',
  7: 'tw:gap-y-7',
  8: 'tw:gap-y-8',
  9: 'tw:gap-y-9',
  10: 'tw:gap-y-10',
  11: 'tw:gap-y-11',
  12: 'tw:gap-y-12',
  14: 'tw:gap-y-14',
  16: 'tw:gap-y-16',
  20: 'tw:gap-y-20',
  24: 'tw:gap-y-24',
  28: 'tw:gap-y-28',
  32: 'tw:gap-y-32',
  36: 'tw:gap-y-36',
  40: 'tw:gap-y-40',
  44: 'tw:gap-y-44',
  48: 'tw:gap-y-48',
  52: 'tw:gap-y-52',
  56: 'tw:gap-y-56',
  60: 'tw:gap-y-60',
  64: 'tw:gap-y-64',
  72: 'tw:gap-y-72',
  80: 'tw:gap-y-80',
  96: 'tw:gap-y-96',
};

/**
 * Static map of column gap values to Tailwind classes.
 * Use this instead of dynamic template literals (e.g. `tw:gap-x-${gap}`)
 * so that Tailwind's static scanner can detect all variants at build time.
 */
export const colGapClassMapping: Record<GapValues, string> = {
  0: 'tw:gap-x-0',
  1: 'tw:gap-x-1',
  2: 'tw:gap-x-2',
  3: 'tw:gap-x-3',
  4: 'tw:gap-x-4',
  5: 'tw:gap-x-5',
  6: 'tw:gap-x-6',
  7: 'tw:gap-x-7',
  8: 'tw:gap-x-8',
  9: 'tw:gap-x-9',
  10: 'tw:gap-x-10',
  11: 'tw:gap-x-11',
  12: 'tw:gap-x-12',
  14: 'tw:gap-x-14',
  16: 'tw:gap-x-16',
  20: 'tw:gap-x-20',
  24: 'tw:gap-x-24',
  28: 'tw:gap-x-28',
  32: 'tw:gap-x-32',
  36: 'tw:gap-x-36',
  40: 'tw:gap-x-40',
  44: 'tw:gap-x-44',
  48: 'tw:gap-x-48',
  52: 'tw:gap-x-52',
  56: 'tw:gap-x-56',
  60: 'tw:gap-x-60',
  64: 'tw:gap-x-64',
  72: 'tw:gap-x-72',
  80: 'tw:gap-x-80',
  96: 'tw:gap-x-96',
};
