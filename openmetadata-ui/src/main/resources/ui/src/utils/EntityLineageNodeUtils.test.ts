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
import { EntityReference } from '../generated/type/entityReference';
import { getNodeLineageData } from './EntityLineageNodeUtils';

describe('getNodeLineageData', () => {
  it('should keep lineageSqlQueries on the node so the edge drawer can resolve sqlQueryKey', () => {
    const lineageSqlQueries = {
      '1': 'CREATE TABLE t AS SELECT * FROM s',
    };
    const node = {
      id: 'n1',
      name: 'target',
      fullyQualifiedName: 'svc.db.sch.target',
      lineageSqlQueries,
    } as unknown as EntityReference;

    const result = getNodeLineageData(node) as {
      lineageSqlQueries?: Record<string, string>;
    };

    expect(result.lineageSqlQueries).toEqual(lineageSqlQueries);
  });
});
