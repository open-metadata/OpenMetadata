/*
 *  Copyright 2024 Collate.
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
import { FormSelectItem } from '@openmetadata/ui-core-components';
import { DEFAULT_PROFILER_CONFIG_VALUE } from '../../constants/profiler.constant';
import {
  DataType,
  MetricConfigurationDefinition,
  MetricType,
  ProfilerConfiguration,
} from '../../generated/configuration/profilerConfiguration';
import { Settings } from '../../generated/settings/settings';

export interface ProfilerConfigurationValues {
  metricConfiguration: (Omit<MetricConfigurationDefinition, 'metrics'> & {
    metrics?: string[];
  })[];
  sampleDataConfig: NonNullable<ProfilerConfiguration['sampleDataConfig']>;
}
export const getProfilerConfigurationValues = (
  config?: Settings['config_value']
): ProfilerConfigurationValues => {
  const profilerConfig = config as ProfilerConfiguration | undefined;

  return {
    metricConfiguration: profilerConfig?.metricConfiguration?.length
      ? profilerConfig.metricConfiguration
      : DEFAULT_PROFILER_CONFIG_VALUE.metricConfiguration ?? [],
    sampleDataConfig:
      profilerConfig?.sampleDataConfig ??
      DEFAULT_PROFILER_CONFIG_VALUE.sampleDataConfig ??
      {},
  };
};
export const getProfilerConfigurationPayload = (
  data: ProfilerConfigurationValues
): ProfilerConfiguration => ({
  metricConfiguration: data.metricConfiguration.map((row) => ({
    ...row,
    metrics: row.metrics?.includes('all')
      ? Object.values(MetricType)
      : row.metrics?.flatMap((metric) =>
          Object.values(MetricType).filter((value) => value === metric)
        ),
  })),
  sampleDataConfig: data.sampleDataConfig,
});

export const getDataTypeItems = (
  rows: ProfilerConfigurationValues['metricConfiguration'],
  index: number
): FormSelectItem[] =>
  Object.values(DataType).map((value) => ({
    id: value,
    label: value,
    isDisabled: rows.some(
      (row, selectedIndex) => selectedIndex !== index && row.dataType === value
    ),
  }));
export const getSelectedDataType = (key: string | number | null) =>
  Object.values(DataType).find((value) => value === key);
