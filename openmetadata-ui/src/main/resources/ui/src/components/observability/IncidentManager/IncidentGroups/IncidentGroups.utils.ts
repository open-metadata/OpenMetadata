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

import { IncidentGroupBy } from '../../../../generated/tests/testCaseIncidentGroup';
import { DEFAULT_INCIDENT_GROUP_BY } from './IncidentGroups.constants';

/**
 * Coerce a raw query string value into a grouping dimension. Anything the API
 * would reject — a missing, repeated or unknown value — falls back to the
 * default dimension instead of firing a request that 400s.
 */
export const parseIncidentGroupBy = (value: unknown): IncidentGroupBy =>
  Object.values(IncidentGroupBy).find((dimension) => dimension === value) ??
  DEFAULT_INCIDENT_GROUP_BY;
