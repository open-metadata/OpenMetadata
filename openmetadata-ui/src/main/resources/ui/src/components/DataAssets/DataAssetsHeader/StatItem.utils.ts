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

export const getStatItemToneClassName = (
  isActive: boolean,
  isInteractive: boolean
): string => {
  if (!isInteractive) {
    return isActive
      ? 'tw:cursor-default tw:text-brand-secondary'
      : 'tw:cursor-default tw:text-quaternary';
  }

  // The pointer is still over the item right after it is toggled on, so the
  // hover tint must not replace the active colour.
  return isActive
    ? 'tw:cursor-pointer tw:text-brand-secondary tw:hover:text-brand-secondary'
    : 'tw:cursor-pointer tw:text-quaternary tw:hover:text-secondary';
};
