/*
 *  Copyright 2023 Collate.
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
import { Table, TableProfile } from '../generated/entity/data/table';
import {
  calculateCustomMetrics,
  getColumnCustomMetric,
} from './TableProfilerUtils';

describe('TableProfilerUtils', () => {
  it('calculateCustomMetrics should return correct data', () => {
    const profiler = [
      {
        timestamp: 1701757499196,
        profileSampleType: 'PERCENTAGE',
        columnCount: 12,
        rowCount: 14567,
        sizeInByte: 16890,
        createDateTime: '2023-07-24T07:00:48.000000Z',
        customMetrics: [
          {
            name: 'CountOfUSAddress',
            value: 15467,
          },
          {
            name: 'CountOfFRAddress',
            value: 1467,
          },
        ],
      },
    ] as unknown as TableProfile[];
    const customMetrics = [
      {
        id: 'id1',
        name: 'CountOfFRAddress',
        expression:
          "SELECT COUNT(address_id) FROM dim_address WHERE country = 'FR'",
        updatedAt: 1701757494892,
        updatedBy: 'admin',
      },
      {
        id: 'id2',
        name: 'CountOfUSAddress',
        expression:
          "SELECT COUNT(address_id) FROM dim_address WHERE country = 'US'",
        updatedAt: 1701757494868,
        updatedBy: 'admin',
      },
    ];
    const data = calculateCustomMetrics(profiler, customMetrics);

    expect(data).toEqual({
      CountOfFRAddress: [
        {
          CountOfFRAddress: 1467,
          formattedTimestamp: 'Dec 05, 11:54',
          timestamp: 1701757499196,
        },
      ],
      CountOfUSAddress: [
        {
          CountOfUSAddress: 15467,
          formattedTimestamp: 'Dec 05, 11:54',
          timestamp: 1701757499196,
        },
      ],
    });
  });

  it('calculateCustomMetrics should return empty object if empty data is provided', () => {
    const data = calculateCustomMetrics([], []);

    expect(data).toEqual({});
  });

  it('getColumnCustomMetric should return correct data', () => {
    const customMetrics = [
      {
        id: 'id1',
        name: 'name1',
        expression: 'expression1',
        updatedAt: 1701757494892,
        updatedBy: 'admin',
      },
    ];
    const table = {
      fullyQualifiedName: 'fqn',
      name: 'name',
      columns: [
        {
          fullyQualifiedName: 'fqn1',
          name: 'name1',
          customMetrics: customMetrics,
        },
      ],
    } as unknown as Table;
    const columnFqn = 'fqn1';
    const data = getColumnCustomMetric(table, columnFqn);

    expect(data).toEqual(customMetrics);
  });

  it('getColumnCustomMetric should return undefined if table, fqn and both is not provided', () => {
    const columnFqn = 'fqn1';
    const customMetrics = [
      {
        id: 'id1',
        name: 'name1',
        expression: 'expression1',
        updatedAt: 1701757494892,
        updatedBy: 'admin',
      },
    ];
    const table = {
      fullyQualifiedName: 'fqn',
      name: 'name',
      columns: [
        {
          fullyQualifiedName: 'fqn1',
          name: 'name1',
          customMetrics: customMetrics,
        },
      ],
    } as unknown as Table;
    const withoutTable = getColumnCustomMetric(undefined, columnFqn);
    const withoutFqn = getColumnCustomMetric(table, undefined);
    const emptyData = getColumnCustomMetric();

    expect(withoutTable).toBeUndefined();
    expect(withoutFqn).toBeUndefined();
    expect(emptyData).toBeUndefined();
  });
});
