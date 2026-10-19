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
// Badge pill palette (utility 50 fill + 700 text) so the tiles keep contrast in both themes.
export const STATUS_TILE_CLASS: Record<string, string> = {
  success: 'tw:bg-utility-success-50 tw:text-utility-success-700',
  failed: 'tw:bg-utility-error-50 tw:text-utility-error-700',
  warning: 'tw:bg-utility-warning-50 tw:text-utility-warning-700',
};
