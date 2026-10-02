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

// Restyles core ButtonGroup into the legacy antd "segment-toggle" pill look. Light values
// use legacy tokens so light mode stays pixel-identical; dark falls back to theme tokens
// because those legacy tokens do not flip.
export const SEGMENT_TOGGLE_GROUP_CLASS = [
  'tw:space-x-0 tw:rounded-xl tw:bg-surface tw:p-0.5 tw:shadow-none',
  'tw:border tw:border-[var(--om-legacy-color-dce3ec)] tw:dark:border-secondary',
].join(' ');

export const SEGMENT_TOGGLE_ITEM_CLASS = [
  'tw:h-7 tw:rounded-lg tw:bg-transparent tw:px-2.75 tw:py-0 tw:not-last:pr-2.75',
  'tw:font-normal tw:text-primary tw:shadow-none tw:after:hidden',
  'tw:hover:bg-transparent tw:hover:text-primary',
  'tw:selected:bg-[var(--om-legacy-color-e6f1fe)] tw:selected:text-brand-secondary',
  'tw:dark:selected:bg-brand-primary',
].join(' ');
