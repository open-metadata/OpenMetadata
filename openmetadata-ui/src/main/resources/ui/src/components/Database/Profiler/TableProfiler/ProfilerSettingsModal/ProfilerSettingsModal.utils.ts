/*
 *  Copyright 2022 Collate.
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
import { isEqual } from 'lodash';
import { DEFAULT_INCLUDE_PROFILE } from '../../../../../constants/profiler.constant';
import {
  ColumnProfilerConfig,
  PartitionIntervalTypes,
  PartitionIntervalUnit,
  ProfileSampleType,
  SampleConfigType,
  TableProfilerConfig,
} from '../../../../../generated/entity/data/table';

export interface ProfilerSettingsValues {
  profileSampleType?: ProfileSampleType;
  profileSamplePercentage?: number | null;
  profileSampleRows?: number;
  sampleDataCount?: number;
  profileQuery: string;
  excludeColumns: string[];
  includeColumns: ColumnProfilerConfig[];
  enablePartitioning: boolean;
  partitionIntervalType?: PartitionIntervalTypes;
  partitionColumnName?: string;
  partitionIntegerRangeStart?: number;
  partitionIntegerRangeEnd?: number;
  partitionInterval?: number;
  partitionIntervalUnit?: PartitionIntervalUnit;
  partitionValues: { value: string }[];
}

export const DEFAULT_VALUES: ProfilerSettingsValues = {
  profileSampleType: ProfileSampleType.Percentage,
  profileSamplePercentage: 100,
  sampleDataCount: 50,
  profileQuery: '',
  excludeColumns: [],
  includeColumns: DEFAULT_INCLUDE_PROFILE,
  enablePartitioning: false,
  partitionValues: [],
};

export const toFormValues = (
  config: TableProfilerConfig
): ProfilerSettingsValues => {
  const sample = config.profileSampleConfig?.config;
  const partitioning = config.partitioning;

  return {
    profileSampleType: sample?.profileSampleType,
    profileSamplePercentage:
      sample?.profileSampleType === ProfileSampleType.Percentage
        ? sample.profileSample
        : undefined,
    profileSampleRows:
      sample?.profileSampleType === ProfileSampleType.Rows
        ? sample.profileSample
        : undefined,
    sampleDataCount: config.sampleDataCount ?? DEFAULT_VALUES.sampleDataCount,
    profileQuery: config.profileQuery ?? '',
    excludeColumns: config.excludeColumns ?? [],
    includeColumns: config.includeColumns?.length
      ? config.includeColumns.map((column) => ({
          ...column,
          metrics: column.metrics?.length ? column.metrics : ['all'],
        }))
      : DEFAULT_INCLUDE_PROFILE,
    enablePartitioning: partitioning?.enablePartitioning ?? false,
    partitionIntervalType: partitioning?.partitionIntervalType,
    partitionColumnName: partitioning?.partitionColumnName,
    partitionIntegerRangeStart: partitioning?.partitionIntegerRangeStart,
    partitionIntegerRangeEnd: partitioning?.partitionIntegerRangeEnd,
    partitionInterval: partitioning?.partitionInterval,
    partitionIntervalUnit: partitioning?.partitionIntervalUnit,
    partitionValues: (partitioning?.partitionValues ?? []).map((value) => ({
      value: String(value),
    })),
  };
};

export const toProfilerConfig = (
  data: ProfilerSettingsValues
): TableProfilerConfig => {
  const profileSample =
    data.profileSampleType === ProfileSampleType.Percentage
      ? data.profileSamplePercentage
      : data.profileSampleRows;

  return {
    excludeColumns: data.excludeColumns.length
      ? data.excludeColumns
      : undefined,
    profileQuery: data.profileQuery || undefined,
    profileSampleConfig:
      data.profileSampleType != null && profileSample != null
        ? {
            sampleConfigType: SampleConfigType.Static,
            config: {
              profileSample,
              profileSampleType: data.profileSampleType,
            },
          }
        : undefined,
    includeColumns: !isEqual(data.includeColumns, DEFAULT_INCLUDE_PROFILE)
      ? data.includeColumns
          .filter((column) => column.columnName !== undefined)
          .map((column) =>
            column.metrics?.[0] === 'all'
              ? { columnName: column.columnName }
              : column
          )
      : undefined,
    partitioning: data.enablePartitioning
      ? {
          enablePartitioning: true,
          partitionColumnName: data.partitionColumnName,
          partitionIntegerRangeStart: data.partitionIntegerRangeStart,
          partitionIntegerRangeEnd: data.partitionIntegerRangeEnd,
          partitionInterval: data.partitionInterval,
          partitionIntervalType: data.partitionIntervalType,
          partitionIntervalUnit: data.partitionIntervalUnit,
          partitionValues:
            data.partitionIntervalType === PartitionIntervalTypes.ColumnValue
              ? data.partitionValues
                  .map(({ value }) => value)
                  .filter((value) => value.length > 0)
              : undefined,
        }
      : undefined,
    sampleDataCount: data.sampleDataCount,
  };
};

export const getProfilerSelectItems = (
  items: { id: string; label: string }[],
  key: string | null
) => {
  if (key && !items.some((item) => item.id === key)) {
    return [...items, { id: key, label: key }];
  }

  return items;
};
