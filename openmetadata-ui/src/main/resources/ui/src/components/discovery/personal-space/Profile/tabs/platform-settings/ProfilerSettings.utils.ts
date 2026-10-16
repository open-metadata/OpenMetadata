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

import { isEmpty, startCase } from 'lodash';
import { DEFAULT_PROFILER_CONFIG_VALUE } from '../../../../../../constants/profiler.constant';
import {
  DataType,
  MetricConfigurationDefinition,
  MetricType,
  ProfilerConfiguration,
} from '../../../../../../generated/configuration/profilerConfiguration';
import { SettingType } from '../../../../../../generated/settings/settings';
import { getSettingsConfigFromConfigType } from '../../../../../../rest/settingConfigAPI';

/** Picking "All" stores every metric, exactly like the classic tree select's parent node. */
export const ALL_METRICS = 'all';

export interface SelectItem {
  id: string;
  label: string;
}

export interface MetricRowValues {
  dataType: SelectItem | null;
  metrics: SelectItem[];
  disabled: boolean;
}

export interface ProfilerFormValues {
  metricConfiguration: MetricRowValues[];
  storeSampleData: boolean;
  readSampleData: boolean;
}

const ALL_METRIC_TYPES = Object.values(MetricType);

export const METRIC_ITEMS: SelectItem[] = ALL_METRIC_TYPES.map((metric) => ({
  id: metric,
  label: startCase(metric),
}));

export const DATA_TYPE_ITEMS: SelectItem[] = Object.values(DataType).map(
  (type) => ({
    id: type,
    label: type,
  })
);

export const isAllMetrics = (metrics?: string[]) =>
  Boolean(metrics?.length) &&
  ALL_METRIC_TYPES.every((metric) => metrics?.includes(metric));

/** Missing parts fall back to the platform defaults, as the classic page does. */
export const withProfilerDefaults = (
  config?: ProfilerConfiguration
): Required<ProfilerConfiguration> => ({
  metricConfiguration: isEmpty(config?.metricConfiguration)
    ? DEFAULT_PROFILER_CONFIG_VALUE.metricConfiguration
    : (config?.metricConfiguration as MetricConfigurationDefinition[]),
  sampleDataConfig:
    config?.sampleDataConfig ?? DEFAULT_PROFILER_CONFIG_VALUE.sampleDataConfig,
});

export const fetchProfilerConfig = async () => {
  const { data } = await getSettingsConfigFromConfigType(
    SettingType.ProfilerConfiguration
  );

  return withProfilerDefaults(
    data?.config_value as ProfilerConfiguration | undefined
  );
};

export const toProfilerFormValues = (
  config: Required<ProfilerConfiguration>,
  allLabel: string
): ProfilerFormValues => ({
  metricConfiguration: config.metricConfiguration.map((row) => ({
    dataType: row.dataType ? { id: row.dataType, label: row.dataType } : null,
    metrics: isAllMetrics(row.metrics)
      ? [{ id: ALL_METRICS, label: allLabel }]
      : (row.metrics ?? []).map(
          (metric) =>
            METRIC_ITEMS.find((item) => item.id === metric) ?? {
              id: metric,
              label: startCase(metric),
            }
        ),
    disabled: Boolean(row.disabled),
  })),
  storeSampleData: Boolean(config.sampleDataConfig?.storeSampleData),
  readSampleData: Boolean(config.sampleDataConfig?.readSampleData),
});

export const toProfilerConfig = (
  values: ProfilerFormValues
): ProfilerConfiguration => ({
  metricConfiguration: values.metricConfiguration.map((row) => {
    const metricIds = row.metrics.map((item) => item.id);

    let metrics: MetricType[] | undefined = metricIds as MetricType[];
    if (metricIds.includes(ALL_METRICS)) {
      metrics = ALL_METRIC_TYPES;
    } else if (!metricIds.length) {
      metrics = undefined;
    }

    return {
      dataType: row.dataType?.id as DataType,
      metrics,
      disabled: row.disabled,
    };
  }),
  sampleDataConfig: {
    storeSampleData: values.storeSampleData,
    readSampleData: values.readSampleData,
  },
});
