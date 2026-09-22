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
import { parseIncidentGroupBy } from './IncidentGroups.utils';

describe('parseIncidentGroupBy', () => {
  it('should keep every dimension the API accepts', () => {
    expect(parseIncidentGroupBy('table')).toBe(IncidentGroupBy.Table);
    expect(parseIncidentGroupBy('testDefinition')).toBe(
      IncidentGroupBy.TestDefinition
    );
    expect(parseIncidentGroupBy('owner')).toBe(IncidentGroupBy.Owner);
  });

  it('should fall back to the default dimension for an unusable value', () => {
    expect(parseIncidentGroupBy(undefined)).toBe(DEFAULT_INCIDENT_GROUP_BY);
    expect(parseIncidentGroupBy('')).toBe(DEFAULT_INCIDENT_GROUP_BY);
    expect(parseIncidentGroupBy('Table')).toBe(DEFAULT_INCIDENT_GROUP_BY);
    expect(parseIncidentGroupBy(['table', 'owner'])).toBe(
      DEFAULT_INCIDENT_GROUP_BY
    );
  });
});
