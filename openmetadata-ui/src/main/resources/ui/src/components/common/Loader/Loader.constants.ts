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

// The `loader*` class names stay as hooks for tests and selectors that look for a spinner.
export const LOADER_BASE_CLASS =
  'loader tw:rounded-[50%] tw:border-solid tw:bg-transparent tw:animate-spin';

export const LOADER_SIZE_CLASS = {
  default: 'tw:size-[50px] tw:border-5 tw:mx-auto tw:my-24',
  small: 'loader-sm tw:size-5 tw:border-2 tw:m-auto',
  'x-small': 'loader-x-sm tw:size-3.5 tw:border-[1.5px] tw:m-auto',
} as const;

// The arc follows the org's theme colour (`--ant-*-color`), as the LESS `@primary-color` did.
export const LOADER_TYPE_CLASS = {
  default: 'tw:border-secondary tw:border-l-(color:--ant-primary-color)',
  success: 'loader-success tw:border-secondary tw:border-l-[#51c41a]',
  error: 'loader-error tw:border-secondary tw:border-l-(color:--ant-error-color)',
  white: 'loader-white tw:border-white tw:border-r-transparent',
} as const;
