/*
 *  Copyright 2024 Collate.
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

import { EXTERNAL_CATEGORY_OPTIONS } from '../../../constants/Alerts.constants';

export const EXTERNAL_DESTINATION_TYPES = EXTERNAL_CATEGORY_OPTIONS.map(
  ({ value }) => value
);

// RHF stores non-field-scoped errors under the `root.*` namespace so they are
// not wiped by field-array (`destinations.*`) mutations such as add/remove
// row. The bridges set the manual "minimum destinations required" error here
// instead of on the `destinations` field path, so a row add/remove only clears
// this sentinel (via `clearErrors`) and never the nested per-destination
// validation errors (e.g. `destinations.0.config.receivers`) surfaced by
// `trigger('destinations')`.
export const DESTINATIONS_MIN_COUNT_ERROR_PATH =
  'root.destinations-required' as const;
