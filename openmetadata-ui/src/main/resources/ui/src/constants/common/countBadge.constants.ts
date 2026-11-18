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

// A solid count bubble pinned to the top-right corner of a `tw:relative` host.
// Core `Badge`'s dark-mode status tint is translucent, so it cannot overlay an
// icon or avatar.
export const COUNT_BADGE_CLASS =
  'tw:absolute tw:-right-1.5 tw:-top-1.5 tw:flex tw:h-[14px] tw:min-w-[14px] ' +
  'tw:items-center tw:justify-center tw:rounded-full tw:bg-error-solid ' +
  'tw:px-1 tw:text-[8px] tw:font-medium tw:leading-none tw:text-white';
