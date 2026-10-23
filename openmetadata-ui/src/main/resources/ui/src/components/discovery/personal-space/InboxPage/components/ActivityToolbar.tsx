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
import {
  Calendar,
  Clock,
  FilterLines,
  LayersTwo01,
  List,
  Mail01,
  Table,
  Users01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_TYPE_KIND } from '../activityKind';
import {
  ActivityFilter,
  ActivityGrouping,
  ACTIVITY_TYPE_KEYS,
  getInboxTabBadge,
  InboxCount,
  INBOX_DATE_RANGE_OPTIONS,
} from '../inbox.utils';
import ActivityToolbarMenu from './ActivityToolbarMenu';

const FILTER_LABEL_KEY: Record<ActivityFilter, string> = {
  [ActivityFilter.All]: 'label.all',
  [ActivityFilter.Mentions]: 'label.mention-plural',
  [ActivityFilter.MyAssets]: 'label.my-asset-plural',
  [ActivityFilter.Following]: 'label.following',
};

// The same feeds as a menu, for a toolbar whose left side holds the host's own
// control.
const SHOW_OPTION: Partial<
  Record<ActivityFilter, { labelKey: string; icon: typeof List }>
> = {
  [ActivityFilter.All]: { labelKey: 'label.all-activity', icon: List },
  [ActivityFilter.Mentions]: { labelKey: 'label.mention-plural', icon: Mail01 },
};

// Day groups are the feed's plain form, so the design offers them as None.
const GROUPING_OPTIONS = [
  { value: ActivityGrouping.Asset, labelKey: 'label.asset', icon: Table },
  { value: ActivityGrouping.User, labelKey: 'label.user', icon: Users01 },
  { value: ActivityGrouping.Day, labelKey: 'label.none', icon: List },
];

export interface ActivityToolbarProps {
  // Items per feed; a feed without one shows no badge.
  counts?: Partial<Record<ActivityFilter, InboxCount>>;
  datePreset: string;
  filter: ActivityFilter;
  // The feeds on offer, in order.
  filters: ActivityFilter[];
  grouping?: ActivityGrouping;
  // The host's own control for the left side; the feeds then move to a menu.
  leading?: ReactNode;
  typeKeys: string[];
  onDatePresetChange?: (key: string) => void;
  onFilterChange: (filter: ActivityFilter) => void;
  // Without it the feed offers no grouping.
  onGroupingChange?: (grouping: ActivityGrouping) => void;
  onTypeKeysChange: (typeKeys: string[]) => void;
}

/**
 * The Activity feed's choice of feed (sub-tabs, or a Show menu beside a host's
 * control) and its Date / Group / Type filters.
 */
const ActivityToolbar = ({
  counts,
  datePreset,
  filter,
  filters,
  grouping = ActivityGrouping.Day,
  leading,
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
  const showOptions = useMemo(
    () =>
      filters.flatMap((value) => {
        const option = SHOW_OPTION[value];

        return option
          ? [
              {
                value,
                label: t(option.labelKey),
                icon: option.icon,
                count: getInboxTabBadge(counts?.[value]),
              },
            ]
          : [];
      }),
    [filters, counts, t]
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
      {leading ?? (
        <Tabs
          className="tw:w-fit"
          selectedKey={filter}
          onSelectionChange={(key) => onFilterChange(key as ActivityFilter)}>
          <Tabs.List size="sm" type="button-border">
            {filters.map((value) => (
              <Tabs.Item
                badge={getInboxTabBadge(counts?.[value])}
                id={value}
                key={value}>
                {t(FILTER_LABEL_KEY[value])}
              </Tabs.Item>
            ))}
          </Tabs.List>
        </Tabs>
      )}
      <Box align="center" gap={2}>
        {leading && showOptions.length > 1 && (
          <ActivityToolbarMenu
            data-testid="activity-show-filter"
            options={showOptions}
            title={t('label.show')}
            triggerIcon={SHOW_OPTION[filter]?.icon ?? List}
            value={filter}
            onChange={(value) => onFilterChange(value as ActivityFilter)}
          />
        )}
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
        {onGroupingChange && (
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
        )}
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
