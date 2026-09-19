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

/**
 * @deprecated Import `FilterSelectDropdown` directly. This module only exists
 * so Collate `main` keeps building against this branch: it still imports this
 * path, and Collate cannot be fixed first because its own migration
 * (openmetadata-collate#6487) pins this branch as its submodule. Delete this
 * file once #6487 has merged — nothing in OpenMetadata imports it.
 */
export { default } from '../common/FilterSelectDropdown/FilterSelectDropdown';
