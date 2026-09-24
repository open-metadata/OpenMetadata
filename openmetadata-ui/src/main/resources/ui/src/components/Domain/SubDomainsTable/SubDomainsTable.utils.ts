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

// This table's toggle only offers Table/Card (no Tree, unlike the top-level
// Domains page) — any saved default other than Grid (including no saved
// default) keeps today's Table starting view.
export const resolveDefaultSubDomainView = (mode?: DefaultViewMode): ViewMode =>
  mode === DefaultViewMode.Grid ? ViewMode.Card : ViewMode.Table;
