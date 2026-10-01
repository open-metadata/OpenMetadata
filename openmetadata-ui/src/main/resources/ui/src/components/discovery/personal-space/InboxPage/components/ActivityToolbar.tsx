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

import { Box, FilterSelect, Tabs } from '@openmetadata/ui-core-components';
import { Calendar, FilterLines, LayersTwo01 } from '@untitledui/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityFilter,
  ActivityGrouping,
  ACTIVITY_TYPE_KEYS,
  INBOX_DATE_RANGE_OPTIONS,
} from '../inbox.utils';

const FILTER_LABEL_KEY: Record<ActivityFilter, string> = {
  [ActivityFilter.All]: 'label.all',
  [ActivityFilter.Mentions]: 'label.mention-plural',
  [ActivityFilter.MyAssets]: 'label.my-asset-plural',
  [ActivityFilter.Following]: 'label.following',
};

const GROUPING_LABEL_KEY: Record<ActivityGrouping, string> = {
  [ActivityGrouping.Day]: 'label.day',
  [ActivityGrouping.Asset]: 'label.asset',
  [ActivityGrouping.User]: 'label.user',
};

export interface ActivityToolbarProps {
  datePreset: string;
  filter: ActivityFilter;
  grouping: ActivityGrouping;
  typeKeys: string[];
  onDatePresetChange?: (key: string) => void;
  onFilterChange: (filter: ActivityFilter) => void;
  onGroupingChange: (grouping: ActivityGrouping) => void;
  onTypeKeysChange: (typeKeys: string[]) => void;
}

/** The Activity feed's sub-tabs (whose activity) and its Group / Type filters. */
const ActivityToolbar = ({
  datePreset,
  filter,
  grouping,
  typeKeys,
  onDatePresetChange,
  onFilterChange,
  onGroupingChange,
  onTypeKeysChange,
}: ActivityToolbarProps) => {
  const { t } = useTranslation();

  const dateOptions = useMemo(
    () =>
      Object.entries(INBOX_DATE_RANGE_OPTIONS).map(([value, preset]) => ({
        value,
        label: t(preset.title, preset.titleData),
      })),
    [t]
  );
  const groupingOptions = useMemo(
    () =>
      Object.values(ActivityGrouping).map((value) => ({
        value,
        label: t(GROUPING_LABEL_KEY[value]),
      })),
    [t]
  );
  const typeOptions = useMemo(
    () => ACTIVITY_TYPE_KEYS.map((value) => ({ value, label: t(value) })),
    [t]
  );

  return (
    <Box
      align="center"
      className="tw:sticky tw:top-0 tw:z-10 tw:flex-wrap tw:justify-between tw:bg-primary tw:py-2"
      data-testid="activity-toolbar"
      gap={2}>
      <Tabs
        className="tw:w-fit"
        selectedKey={filter}
        onSelectionChange={(key) => onFilterChange(key as ActivityFilter)}>
        <Tabs.List size="sm" type="button-border">
          {Object.values(ActivityFilter).map((value) => (
            <Tabs.Item
              id={value}
              key={value}
              label={t(FILTER_LABEL_KEY[value])}
            />
          ))}
        </Tabs.List>
      </Tabs>
      <Box align="center" gap={2}>
        {onDatePresetChange && (
          <FilterSelect
            bordered
            data-testid="activity-date-filter"
            label={t('label.date')}
            options={dateOptions}
            popoverClassName="tw:w-48"
            selectedValues={[datePreset]}
            selectionMode="single"
            triggerIcon={Calendar}
            triggerVariant="button"
            onChange={([value]) => value && onDatePresetChange(value)}
          />
        )}
        <FilterSelect
          bordered
          data-testid="activity-group-filter"
          label={t('label.group-by')}
          options={groupingOptions}
          popoverClassName="tw:w-36"
          selectedValues={[grouping]}
          selectionMode="single"
          triggerIcon={LayersTwo01}
          triggerVariant="button"
          onChange={([value]) =>
            onGroupingChange(
              (value as ActivityGrouping) ?? ActivityGrouping.Day
            )
          }
        />
        <FilterSelect
          bordered
          hideCounts
          data-testid="activity-type-filter"
          label={t('label.type')}
          options={typeOptions}
          popoverClassName="tw:w-52"
          selectedValues={typeKeys}
          selectionMode="multiple"
          triggerIcon={FilterLines}
          triggerVariant="button"
          onChange={onTypeKeysChange}
        />
      </Box>
    </Box>
  );
};

export default ActivityToolbar;
