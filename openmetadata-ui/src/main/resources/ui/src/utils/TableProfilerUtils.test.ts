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
  calculateColumnProfilerMetrics,
  calculateCustomMetrics,
  getColumnCustomMetric,
} from './TableProfilerUtils';
import { CalculateColumnProfilerMetricsInterface } from './TableProfilerUtils.interface';

jest.mock('./date-time/DateTimeUtils', () => {
  return {
    customFormatDateTime: jest.fn().mockReturnValue('Dec 05, 11:54'),
  };
});

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

const countMetrics = {
  information: [
    { label: 'Distinct Count', dataKey: 'distinctCount' },
    { label: 'Null Count', dataKey: 'nullCount' },
    { label: 'Unique Count', dataKey: 'uniqueCount' },
    { label: 'Values Count', dataKey: 'valuesCount' },
  ],
};

const proportionMetrics = {
  information: [
    { label: 'Distinct Proportion', dataKey: 'distinctProportion' },
    { label: 'Null Proportion', dataKey: 'nullProportion' },
    { label: 'Unique Proportion', dataKey: 'uniqueProportion' },
  ],
};

const mathMetrics = {
  information: [
    { label: 'Max', dataKey: 'max' },
    { label: 'Min', dataKey: 'min' },
    { label: 'Mean', dataKey: 'mean' },
  ],
};

const sumMetrics = {
  information: [{ label: 'Sum', dataKey: 'sum' }],
};

const quartileMetrics = {
  information: [
    { label: 'First Quartile', dataKey: 'firstQuartile' },
    { label: 'Third Quartile', dataKey: 'thirdQuartile' },
    { label: 'Inter Quartile Range', dataKey: 'interQuartileRange' },
    { label: 'Median', dataKey: 'median' },
  ],
};

describe('TableProfilerUtils', () => {
  it('calculateCustomMetrics should return correct data', () => {
    const profiler = [
      {
        timestamp: 1701757494892,
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
          timestamp: 1701757494892,
        },
      ],
      CountOfUSAddress: [
        {
          CountOfUSAddress: 15467,
          formattedTimestamp: 'Dec 05, 11:54',
          timestamp: 1701757494892,
        },
      ],
    });
  });

  it('calculateCustomMetrics should return empty object if empty data is provided', () => {
    const data = calculateCustomMetrics([], []);

    expect(data).toEqual({});
  });

  it('getColumnCustomMetric should return correct data', () => {
    const data = getColumnCustomMetric(table, columnFqn);

    expect(data).toEqual(customMetrics);
  });

  it('getColumnCustomMetric should return undefined if table, fqn and both is not provided', () => {
    const withoutTable = getColumnCustomMetric(undefined, columnFqn);
    const withoutFqn = getColumnCustomMetric(table, undefined);
    const emptyData = getColumnCustomMetric();

    expect(withoutTable).toBeUndefined();
    expect(withoutFqn).toBeUndefined();
    expect(emptyData).toBeUndefined();
  });

  it('calculateColumnProfilerMetrics should calculate column profiler metrics correctly', () => {
    const columnProfilerData = [
      {
        timestamp: 1701757494892,
        distinctCount: 100,
        nullCount: 10,
        uniqueCount: 90,
        valuesCount: 200,
        sum: 500,
        max: 100,
        min: 0,
        mean: 50,
        distinctProportion: 0.5,
        nullProportion: 0.05,
        uniqueProportion: 0.45,
        firstQuartile: 25,
        thirdQuartile: 75,
        interQuartileRange: 50,
        median: 50,
      },
    ];

    const result = calculateColumnProfilerMetrics({
      columnProfilerData,
      countMetrics,
      proportionMetrics,
      mathMetrics,
      sumMetrics,
      quartileMetrics,
    } as unknown as CalculateColumnProfilerMetricsInterface);

    expect(result.countMetrics.data).toEqual([
      {
        name: 'Dec 05, 11:54',
        timestamp: 1701757494892,
        distinctCount: 100,
        nullCount: 10,
        uniqueCount: 90,
        valuesCount: 200,
      },
    ]);

    expect(result.proportionMetrics.data).toEqual([
      {
        name: 'Dec 05, 11:54',
        timestamp: 1701757494892,
        distinctProportion: 50,
        nullProportion: 5,
        uniqueProportion: 45,
      },
    ]);

    expect(result.mathMetrics.data).toEqual([
      {
        name: 'Dec 05, 11:54',
        timestamp: 1701757494892,
        max: 100,
        min: 0,
        mean: 50,
      },
    ]);

    expect(result.sumMetrics.data).toEqual([
      {
        name: 'Dec 05, 11:54',
        timestamp: 1701757494892,
        sum: 500,
      },
    ]);

    expect(result.quartileMetrics.data).toEqual([
      {
        name: 'Dec 05, 11:54',
        timestamp: 1701757494892,
        firstQuartile: 25,
        thirdQuartile: 75,
        interQuartileRange: 50,
        median: 50,
      },
    ]);
  });

  it('calculateColumnProfilerMetrics should only calculate metric based on available data', () => {
    const columnProfilerData = [
      {
        timestamp: 1701757494892,
        distinctCount: 100,
        nullCount: 10,
        uniqueCount: 90,
        valuesCount: 200,
        max: 100,
        min: 0,
        distinctProportion: 0.5,
        nullProportion: 0.05,
        uniqueProportion: 0.45,
      },
    ];

    const result = calculateColumnProfilerMetrics({
      columnProfilerData,
      countMetrics,
      proportionMetrics,
      mathMetrics,
      sumMetrics,
      quartileMetrics,
    } as unknown as CalculateColumnProfilerMetricsInterface);

    expect(result.countMetrics.data).toEqual([
      {
        name: 'Dec 05, 11:54',
        timestamp: 1701757494892,
        distinctCount: 100,
        nullCount: 10,
        uniqueCount: 90,
        valuesCount: 200,
      },
    ]);
    expect(result.proportionMetrics.data).toEqual([
      {
        name: 'Dec 05, 11:54',
        timestamp: 1701757494892,
        distinctProportion: 50,
        nullProportion: 5,
        uniqueProportion: 45,
      },
    ]);
    expect(result.mathMetrics.data).toEqual([
      {
        name: 'Dec 05, 11:54',
        timestamp: 1701757494892,
        max: 100,
        min: 0,
      },
    ]);
    expect(result.sumMetrics.data).toEqual([]);
    expect(result.quartileMetrics.data).toEqual([]);
  });
});
