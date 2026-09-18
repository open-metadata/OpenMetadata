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

import { Table } from '@openmetadata/ui-core-components/icons';
// CheckCircle and User01 have no counterpart in the core-components icon
// barrel, which only re-exports the design team's own SVG set.
import { CheckCircle, User01 } from '@untitledui/icons';
import { IncidentGroupBy } from '../../../../generated/tests/testCaseIncidentGroup';
import { IncidentGroupByOption } from './IncidentGroups.types';

/**
 * Query string param holding the selected grouping dimension. It shares its
 * name with the API param so the URL reads like the request it produces.
 */
export const INCIDENT_GROUP_BY_PARAM = 'groupBy';

/** Dimension the page opens with when the URL does not carry a valid one. */
export const DEFAULT_INCIDENT_GROUP_BY = IncidentGroupBy.TestDefinition;

/** Number of groups requested per page. */
export const INCIDENT_GROUPS_PAGE_SIZE = 10;

/**
 * The grouping dimensions offered by the `Group by` dropdown, in the order
 * they are listed there.
 */
export const INCIDENT_GROUP_BY_OPTIONS: IncidentGroupByOption[] = [
  {
    key: IncidentGroupBy.TestDefinition,
    labelKey: 'label.test-case-type',
    icon: CheckCircle,
  },
  {
    key: IncidentGroupBy.Table,
    labelKey: 'label.table',
    icon: Table,
  },
  {
    key: IncidentGroupBy.Owner,
    labelKey: 'label.test-case-owner',
    icon: User01,
  },
];
