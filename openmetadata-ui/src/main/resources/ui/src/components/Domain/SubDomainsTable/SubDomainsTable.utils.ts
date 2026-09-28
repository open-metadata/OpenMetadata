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
import { DefaultViewMode } from '../../../generated/api/configuration/appConfiguration';
import { ViewMode } from '../../common/ViewToggle/ViewToggle';

// Sub Domains has no default of its own in General Preferences until the
// admin explicitly adds a "Sub Domains" row there — until then it inherits
// the Domains page's default instead of always starting on Table. This
// table's toggle only offers Table/Card (no Tree, unlike the top-level
// Domains page), so a Tree default on Domains falls back to Table here too.
export const resolveDefaultSubDomainView = (
  subDomainMode?: DefaultViewMode,
  domainMode?: DefaultViewMode
): ViewMode => {
  const mode = subDomainMode ?? domainMode;

  return mode === DefaultViewMode.Grid ? ViewMode.Card : ViewMode.Table;
};
