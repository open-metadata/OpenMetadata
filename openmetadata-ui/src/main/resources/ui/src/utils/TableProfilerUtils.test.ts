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
import {
  ColumnProfile,
  Table,
  TableProfile,
} from '../generated/entity/data/table';
import {
  calculateColumnProfilerMetrics,
  calculateCustomMetrics,
  formatProfileMetricValue,
  getColumnCustomMetric,
  getKeyProfileMetrics,
} from './TableProfilerUtils';
import { CalculateColumnProfilerMetricsInterface } from './TableProfilerUtils.interface';

const DEC_05_11_54 = 'Dec 05, 11:54' as const;
const LABEL_UNIQUENESS = 'label.uniqueness' as const;
const MESSAGE_UNIQUENESS_PROFILE_METRIC_DESCRIPTION =
  'message.uniqueness-profile-metric-description' as const;
const LABEL_NULLNESS = 'label.nullness' as const;
const MESSAGE_NULLNESS_PROFILE_METRIC_DESCRIPTION =
  'message.nullness-profile-metric-description' as const;
const LABEL_DISTINCT = 'label.distinct' as const;
const MESSAGE_DISTINCT_PROFILE_METRIC_DESCRIPTION =
  'message.distinct-profile-metric-description' as const;
const LABEL_VALUE_COUNT = 'label.value-count' as const;
const MESSAGE_VALUE_COUNT_PROFILE_METRIC_DESCRIPTION =
  'message.value-count-profile-metric-description' as const;

jest.mock('./date-time/DateTimeUtils', () => {
  return {
    customFormatDateTime: jest.fn().mockReturnValue('Dec 05, 11:54'),
  };
});

jest.mock('./NumberUtils', () => ({
  calculatePercentage: jest.fn((numerator, denominator, precision, format) => {
    const value = (numerator / denominator) * 100;

    return format ? `${value.toFixed(precision)}%` : value;
  }),
  formatNumberWithComma: jest.fn((value) => value.toLocaleString()),
}));

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
          formattedTimestamp: DEC_05_11_54,
          timestamp: 1701757494892,
        },
      ],
      CountOfUSAddress: [
        {
          CountOfUSAddress: 15467,
          formattedTimestamp: DEC_05_11_54,
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
        name: DEC_05_11_54,
        timestamp: 1701757494892,
        distinctCount: 100,
        nullCount: 10,
        uniqueCount: 90,
        valuesCount: 200,
      },
    ]);

    expect(result.proportionMetrics.data).toEqual([
      {
        name: DEC_05_11_54,
        timestamp: 1701757494892,
        distinctProportion: 50,
        nullProportion: 5,
        uniqueProportion: 45,
      },
    ]);

    expect(result.mathMetrics.data).toEqual([
      {
        name: DEC_05_11_54,
        timestamp: 1701757494892,
        max: 100,
        min: 0,
        mean: 50,
      },
    ]);

    expect(result.sumMetrics.data).toEqual([
      {
        name: DEC_05_11_54,
        timestamp: 1701757494892,
        sum: 500,
      },
    ]);

    expect(result.quartileMetrics.data).toEqual([
      {
        name: DEC_05_11_54,
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
        name: DEC_05_11_54,
        timestamp: 1701757494892,
        distinctCount: 100,
        nullCount: 10,
        uniqueCount: 90,
        valuesCount: 200,
      },
    ]);
    expect(result.proportionMetrics.data).toEqual([
      {
        name: DEC_05_11_54,
        timestamp: 1701757494892,
        distinctProportion: 50,
        nullProportion: 5,
        uniqueProportion: 45,
      },
    ]);
    expect(result.mathMetrics.data).toEqual([
      {
        name: DEC_05_11_54,
        timestamp: 1701757494892,
        max: 100,
        min: 0,
      },
    ]);
    expect(result.sumMetrics.data).toEqual([]);
    expect(result.quartileMetrics.data).toEqual([]);
  });

  describe('formatProfileMetricValue', () => {
    it('should return NO_DATA_PLACEHOLDER when value is null', () => {
      const result = formatProfileMetricValue(null);

      expect(result).toBe('--');
    });

    it('should return NO_DATA_PLACEHOLDER when value is undefined', () => {
      const result = formatProfileMetricValue(undefined);

      expect(result).toBe('--');
    });

    it('should return the value when no formatter is provided', () => {
      const result = formatProfileMetricValue(42);

      expect(result).toBe(42);
    });

    it('should apply formatter when provided', () => {
      const formatter = (value: number) => `${value * 2}`;
      const result = formatProfileMetricValue(21, formatter);

      expect(result).toBe('42');
    });

    it('should handle formatter returning number', () => {
      const formatter = (value: number) => value * 2;
      const result = formatProfileMetricValue(21, formatter);

      expect(result).toBe(42);
    });
  });

  describe('getKeyProfileMetrics', () => {
    const mockT = (key: string) => key;

    it('should return metrics with NO_DATA_PLACEHOLDER when profile is undefined', () => {
      const result = getKeyProfileMetrics(undefined, mockT);

      expect(result).toEqual([
        {
          label: LABEL_UNIQUENESS,
          value: '--',
          tooltip: MESSAGE_UNIQUENESS_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_NULLNESS,
          value: '--',
          tooltip: MESSAGE_NULLNESS_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_DISTINCT,
          value: '--',
          tooltip: MESSAGE_DISTINCT_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_VALUE_COUNT,
          value: '--',
          tooltip: MESSAGE_VALUE_COUNT_PROFILE_METRIC_DESCRIPTION,
        },
      ]);
    });

    it('should return formatted metrics when profile has valid data', () => {
      const profile: ColumnProfile = {
        name: 'name',
        uniqueProportion: 0.75,
        nullProportion: 0.1,
        distinctProportion: 0.6,
        valuesCount: 1000,
        timestamp: 1701757494892,
      };

      const result = getKeyProfileMetrics(profile, mockT);

      expect(result).toEqual([
        {
          label: LABEL_UNIQUENESS,
          value: '75%',
          tooltip: MESSAGE_UNIQUENESS_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_NULLNESS,
          value: '10%',
          tooltip: MESSAGE_NULLNESS_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_DISTINCT,
          value: '60%',
          tooltip: MESSAGE_DISTINCT_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_VALUE_COUNT,
          value: '1,000',
          tooltip: MESSAGE_VALUE_COUNT_PROFILE_METRIC_DESCRIPTION,
        },
      ]);
    });

    it('should handle profile with null values', () => {
      const profile: ColumnProfile = {
        name: 'name',
        uniqueProportion: null,
        nullProportion: null,
        distinctProportion: null,
        valuesCount: null,
        timestamp: 1701757494892,
      };

      const result = getKeyProfileMetrics(profile, mockT);

      expect(result).toEqual([
        {
          label: LABEL_UNIQUENESS,
          value: '--',
          tooltip: MESSAGE_UNIQUENESS_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_NULLNESS,
          value: '--',
          tooltip: MESSAGE_NULLNESS_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_DISTINCT,
          value: '--',
          tooltip: MESSAGE_DISTINCT_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_VALUE_COUNT,
          value: '--',
          tooltip: MESSAGE_VALUE_COUNT_PROFILE_METRIC_DESCRIPTION,
        },
      ]);
    });

    it('should handle profile with partial data', () => {
      const profile: ColumnProfile = {
        name: 'test_column',
        uniqueProportion: 0.5,
        nullProportion: null,
        distinctProportion: undefined,
        valuesCount: 500,
        timestamp: 1701757494892,
      };

      const result = getKeyProfileMetrics(profile, mockT);

      expect(result).toEqual([
        {
          label: LABEL_UNIQUENESS,
          value: '50%',
          tooltip: MESSAGE_UNIQUENESS_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_NULLNESS,
          value: '--',
          tooltip: MESSAGE_NULLNESS_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_DISTINCT,
          value: '--',
          tooltip: MESSAGE_DISTINCT_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_VALUE_COUNT,
          value: '500',
          tooltip: MESSAGE_VALUE_COUNT_PROFILE_METRIC_DESCRIPTION,
        },
      ]);
    });

    it('should handle zero values correctly', () => {
      const profile: ColumnProfile = {
        name: 'test_column',
        uniqueProportion: 0,
        nullProportion: 0,
        distinctProportion: 0,
        valuesCount: 0,
        timestamp: 1701757494892,
      };

      const result = getKeyProfileMetrics(profile, mockT);

      expect(result).toEqual([
        {
          label: LABEL_UNIQUENESS,
          value: '0%',
          tooltip: MESSAGE_UNIQUENESS_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_NULLNESS,
          value: '0%',
          tooltip: MESSAGE_NULLNESS_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_DISTINCT,
          value: '0%',
          tooltip: MESSAGE_DISTINCT_PROFILE_METRIC_DESCRIPTION,
        },
        {
          label: LABEL_VALUE_COUNT,
          value: '0',
          tooltip: MESSAGE_VALUE_COUNT_PROFILE_METRIC_DESCRIPTION,
        },
      ]);
    });
  });
});
