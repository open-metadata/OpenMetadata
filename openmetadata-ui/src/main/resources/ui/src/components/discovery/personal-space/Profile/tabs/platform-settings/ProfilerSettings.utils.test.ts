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

import { values } from 'lodash';
import {
  DataType,
  MetricType,
} from '../../../../../../generated/configuration/profilerConfiguration';
import {
  ALL_METRICS,
  toProfilerConfig,
  toProfilerFormValues,
  withProfilerDefaults,
} from './ProfilerSettings.utils';

const ALL = values(MetricType);

describe('ProfilerSettings.utils', () => {
  it('falls back to the platform defaults for missing parts', () => {
    expect(withProfilerDefaults(undefined)).toEqual({
      metricConfiguration: [],
      sampleDataConfig: { storeSampleData: true, readSampleData: true },
    });
  });

  it('shows a row holding every metric as the single "All" choice', () => {
    const values = toProfilerFormValues(
      withProfilerDefaults({
        metricConfiguration: [{ dataType: DataType.Int, metrics: ALL }],
      }),
      'All'
    );

    expect(values.metricConfiguration[0].metrics).toEqual([
      { id: ALL_METRICS, label: 'All' },
    ]);
  });

  it('expands "All" back to every metric on save, and keeps explicit picks as-is', () => {
    const config = toProfilerConfig({
      metricConfiguration: [
        {
          dataType: { id: DataType.Int, label: DataType.Int },
          metrics: [{ id: ALL_METRICS, label: 'All' }],
          disabled: false,
        },
        {
          dataType: { id: DataType.Array, label: DataType.Array },
          metrics: [{ id: MetricType.Max, label: 'Max' }],
          disabled: true,
        },
      ],
      storeSampleData: true,
      readSampleData: false,
    });

    expect(config.metricConfiguration?.[0].metrics).toEqual(ALL);
    expect(config.metricConfiguration?.[1]).toEqual({
      dataType: DataType.Array,
      metrics: [MetricType.Max],
      disabled: true,
    });
    expect(config.sampleDataConfig).toEqual({
      storeSampleData: true,
      readSampleData: false,
    });
  });

  it('omits metrics on a row with none picked, as the classic form did', () => {
    const config = toProfilerConfig({
      metricConfiguration: [
        {
          dataType: { id: DataType.Int, label: DataType.Int },
          metrics: [],
          disabled: true,
        },
      ],
      storeSampleData: false,
      readSampleData: false,
    });

    expect(config.metricConfiguration?.[0].metrics).toBeUndefined();
  });
});
