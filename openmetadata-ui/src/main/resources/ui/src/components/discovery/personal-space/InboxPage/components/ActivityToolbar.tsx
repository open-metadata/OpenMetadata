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
  Badge,
  Box,
  FilterSelect,
  Tabs,
} from '@openmetadata/ui-core-components';
import {
  Calendar,
  Clock,
  FilterLines,
  LayersTwo01,
  List,
  Table,
  Users01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_TYPE_KIND } from '../activityKind';
import {
  ActivityFilter,
  ActivityGrouping,
  ACTIVITY_TYPE_KEYS,
  formatInboxCount,
  InboxCount,
  INBOX_DATE_RANGE_OPTIONS,
} from '../inbox.utils';
import ActivityToolbarMenu, {
  ACTIVITY_TRIGGER_CLASS_NAME,
} from './ActivityToolbarMenu';

const FILTER_LABEL_KEY: Record<ActivityFilter, string> = {
  [ActivityFilter.All]: 'label.all',
  [ActivityFilter.Mentions]: 'label.mention-plural',
  [ActivityFilter.MyAssets]: 'label.my-asset-plural',
  [ActivityFilter.Following]: 'label.following',
};

// Day groups are the feed's plain form, so the design offers them as None.
const GROUPING_OPTIONS = [
  { value: ActivityGrouping.Asset, labelKey: 'label.asset', icon: Table },
  { value: ActivityGrouping.User, labelKey: 'label.user', icon: Users01 },
  { value: ActivityGrouping.Day, labelKey: 'label.none', icon: List },
];

export interface ActivityToolbarProps {
  // Items per sub-tab; a tab without one shows no badge.
  counts?: Partial<Record<ActivityFilter, InboxCount>>;
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
  counts,
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
        // A single day reads as a time, a span as dates.
        icon: preset.days === 1 ? Clock : Calendar,
      })),
    [t]
  );
  const groupingOptions = useMemo(
    () =>
      GROUPING_OPTIONS.map(({ value, labelKey, icon }) => ({
        value,
        label: t(labelKey),
        icon,
      })),
    [t]
  );
  const typeOptions = useMemo(
    () =>
      ACTIVITY_TYPE_KEYS.map((value) => {
        const { icon: Icon, iconClassName } = ACTIVITY_TYPE_KIND[value];

        return {
          value,
          label: t(value),
          icon: <Icon className={classNames('tw:size-4', iconClassName)} />,
        };
      }),
    [t]
  );

  return (
    <Box
      align="center"
      className="tw:flex-wrap tw:justify-between"
      data-testid="activity-toolbar"
      gap={2}>
      <Tabs
        className="tw:w-fit"
        selectedKey={filter}
        onSelectionChange={(key) => onFilterChange(key as ActivityFilter)}>
        {/* The design sets the tabs on the tertiary gray, a step darker. */}
        <Tabs.List className="tw:bg-tertiary" size="sm" type="button-border">
          {Object.values(ActivityFilter).map((value) => {
            const count = counts?.[value];

            return (
              // The design's tighter tabs, so a count fits without wrapping.
              <Tabs.Item
                className="tw:gap-1.5 tw:px-2.25"
                id={value}
                key={value}>
                {/* The tab's own badge stays gray; the design tints the chosen one. */}
                {({ isSelected }) => (
                  <>
                    {t(FILTER_LABEL_KEY[value])}
                    {count?.total ? (
                      <Badge
                        // Keeps a badged tab as tall as a bare one.
                        className="tw:-my-px"
                        color={isSelected ? 'brand' : 'gray'}
                        size="sm"
                        type="color">
                        {formatInboxCount(count)}
                      </Badge>
                    ) : null}
                  </>
                )}
              </Tabs.Item>
            );
          })}
        </Tabs.List>
      </Tabs>
      <Box align="center" gap={2}>
        {onDatePresetChange && (
          <ActivityToolbarMenu
            data-testid="activity-date-filter"
            options={dateOptions}
            title={t('label.date')}
            triggerIcon={Calendar}
            value={datePreset}
            onChange={onDatePresetChange}
          />
        )}
        <ActivityToolbarMenu
          data-testid="activity-group-filter"
          options={groupingOptions}
          title={t('label.group-by')}
          triggerIcon={LayersTwo01}
          triggerLabel={
            grouping === ActivityGrouping.Day ? t('label.group') : undefined
          }
          value={grouping}
          onChange={(value) => onGroupingChange(value as ActivityGrouping)}
        />
        <FilterSelect
          bordered
          hideCounts
          className={ACTIVITY_TRIGGER_CLASS_NAME}
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
