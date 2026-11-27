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
import {
  DataType,
  MetricType,
} from '../../generated/configuration/profilerConfiguration';
import { getProfilerConfigurationPayload } from './ProfilerConfigurationPage.utils';

const getPayloadMetrics = (metrics?: string[]) =>
  getProfilerConfigurationPayload({
    metricConfiguration: [{ dataType: DataType.Int, metrics }],
    sampleDataConfig: {},
  }).metricConfiguration?.[0].metrics;

describe('getProfilerConfigurationPayload', () => {
  it('keeps metrics unknown to the client enum', () => {
    expect(getPayloadMetrics([MetricType.Max, 'futureServerMetric'])).toEqual([
      MetricType.Max,
      'futureServerMetric',
    ]);
  });

  it('expands all to every metric type', () => {
    expect(getPayloadMetrics(['all'])).toEqual(Object.values(MetricType));
  });

  it('leaves undefined metrics undefined', () => {
    expect(getPayloadMetrics(undefined)).toBeUndefined();
  });
});
