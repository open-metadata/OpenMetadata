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

import { StatusType } from '../generated/entity/data/pipeline';
import { formatDuration } from './date-time/DateTimeUtils';
import { getTableViewData } from './executionUtils';

describe('getTableViewData', () => {
  it('carries task metrics and a safe log link into the view rows', () => {
    const rows = getTableViewData(
      [
        {
          timestamp: 1715404800000,
          executionStatus: StatusType.Successful,
          taskStatus: [
            {
              name: 'load_orders',
              executionStatus: StatusType.Successful,
              startTime: 1715404800000,
              endTime: 1715404802000,
              logLink: 'https://orchestrator.example/runs/1',
              metrics: {
                rowsRead: 1234,
                rowsWritten: 1200,
                rowsFiltered: 34,
                executionTimeMs: 1500,
              },
            },
            {
              name: 'notify',
              executionStatus: StatusType.Successful,
              logLink: 'javascript:alert(1)',
            },
          ],
        },
      ],
      StatusType.Successful,
      undefined
    );

    expect(rows).toHaveLength(2);
    expect(rows?.[0]).toMatchObject({
      name: 'load_orders',
      duration: formatDuration(2000),
      rowsRead: 1234,
      rowsWritten: 1200,
      rowsFiltered: 34,
      executionTime: formatDuration(1500),
      logLink: 'https://orchestrator.example/runs/1',
    });
    expect(rows?.[1]).toMatchObject({ name: 'notify', duration: '--' });
    expect(rows?.[1].executionTime).toBeUndefined();
    expect(rows?.[1].logLink).toBeUndefined();
  });
});
