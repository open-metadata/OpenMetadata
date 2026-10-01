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
  Box,
  EmptyPlaceholder,
  Typography,
} from '@openmetadata/ui-core-components';
import { FilterFunnel01, Hourglass01 } from '@untitledui/icons';
import classNames from 'classnames';
import { groupBy } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePersonalSpaceStore } from '../../../../../hooks/usePersonalSpaceStore';
import { formatDate } from '../../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import ActivityFeedItem from '../components/ActivityFeedItem';
import ActivitySkeleton from '../components/ActivitySkeleton';
import ActivityToolbar from '../components/ActivityToolbar';
import {
  ActivityFilter,
  ActivityGrouping,
  ACTIVITY_CLOCK_FORMAT,
  ACTIVITY_DATE_FORMAT,
  DEFAULT_INBOX_DATE_PRESET,
  getActivityDayLabel,
  getActivityTypeKey,
  InboxDateRange,
} from '../inbox.utils';
import {
  getInboxItemTimestamp,
  InboxActivityItem,
  useInboxActivity,
} from '../useInboxActivity';
import { useIncrementalRender } from '../useIncrementalRender';
import { useIsScrolled } from '../useIsScrolled';

// Cards rendered per batch. The feed is fetched whole (up to ACTIVITY_LIMIT),
// but mounting all of it made opening the detail drawer block for a second.
const ACTIVITY_RENDER_BATCH = 40;

const getItemEntity = ({ activity, feed }: InboxActivityItem) =>
  activity?.entity ?? feed?.entityRef;
const getItemActor = ({ activity, feed }: InboxActivityItem) =>
  activity?.actor ?? feed?.createdBy;

// How each grouping keys an item and titles its group.
const GROUPING: Record<
  ActivityGrouping,
  {
    key: (item: InboxActivityItem) => string;
    title: (item: InboxActivityItem) => string;
  }
> = {
  [ActivityGrouping.Day]: {
    key: (item) => formatDate(getInboxItemTimestamp(item)),
    title: (item) => getActivityDayLabel(getInboxItemTimestamp(item)),
  },
  [ActivityGrouping.Asset]: {
    key: (item) => getItemEntity(item)?.id ?? '',
    title: (item) => getEntityName(getItemEntity(item)),
  },
  [ActivityGrouping.User]: {
    key: (item) => getItemActor(item)?.name ?? '',
    title: (item) => getEntityName(getItemActor(item)),
  },
};

export interface ActivityTabProps {
  dateRange?: InboxDateRange;
  onDatePresetChange?: (key: string) => void;
  // Narrowed window → empty reads as "no activity in period" vs first-run state.
  isFiltered?: boolean;
  onCountChange?: (count: number) => void;
}

const ActivityTab: React.FC<ActivityTabProps> = ({
  dateRange,
  onDatePresetChange,
  isFiltered = false,
  onCountChange,
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState(ActivityFilter.All);
  const [grouping, setGrouping] = useState(ActivityGrouping.Day);
  const [typeKeys, setTypeKeys] = useState<string[]>([]);
  const markInboxActivitySeen = usePersonalSpaceStore(
    (s) => s.markInboxActivitySeen
  );

  // Looking at the list is what clears the sidebar's unread badge; feeds have no
  // server-side read state to update.
  useEffect(() => {
    markInboxActivitySeen();
  }, [markInboxActivitySeen]);

  // Shared with the badge (one fetch); merge semantics documented on the hook.
  const { items, total, isLoading } = useInboxActivity(filter, dateRange);
  // ponytail: types filter the loaded page only; the server has no type filter.
  const filteredItems = useMemo(
    () =>
      typeKeys.length
        ? items.filter(({ activity }) =>
            typeKeys.includes(getActivityTypeKey(activity))
          )
        : items,
    [items, typeKeys]
  );

  useEffect(() => {
    onCountChange?.(total);
  }, [total, onCountChange]);

  const { isScrolled, onScroll } = useIsScrolled();
  const { visibleItems, hasMore, scrollRef, sentinelRef } =
    useIncrementalRender(
      filteredItems,
      ACTIVITY_RENDER_BATCH,
      `${filter}:${typeKeys}:${dateRange?.startTs}:${dateRange?.endTs}`
    );

  // Groups keep the feed's newest-first order, as does each group's cards.
  const groups = useMemo(() => {
    const { key, title } = GROUPING[grouping];

    return Object.values(groupBy(visibleItems, key)).map((groupItems) => ({
      key: key(groupItems[0]),
      title: title(groupItems[0]),
      items: groupItems,
    }));
  }, [visibleItems, grouping]);
  const timeFormat =
    grouping === ActivityGrouping.Day
      ? ACTIVITY_CLOCK_FORMAT
      : ACTIVITY_DATE_FORMAT;

  const emptyPlaceholder =
    isFiltered || typeKeys.length ? (
      <EmptyPlaceholder
        data-testid="inbox-activity-no-results"
        description={t('message.activity-feed-no-results-description')}
        icon={
          <FilterFunnel01 className="tw:size-7 tw:text-utility-gray-blue-600" />
        }
        title={t('label.no-activity-in-period')}
        variant="blank"
      />
    ) : (
      <EmptyPlaceholder
        data-testid="inbox-activity-empty"
        description={t('message.activity-feed-empty-description')}
        icon={<Hourglass01 className="tw:size-7 tw:text-utility-brand-600" />}
        title={t('label.activity-feed-starts-here')}
        variant="blank"
      />
    );

  let activityContent: React.ReactNode;
  if (isLoading) {
    activityContent = <ActivitySkeleton />;
  } else if (filteredItems.length === 0) {
    activityContent = emptyPlaceholder;
  } else {
    activityContent = (
      <Box direction="col" gap={4}>
        {groups.map((group) => (
          <Box
            data-testid="activity-group"
            direction="col"
            gap={3}
            key={group.key}>
            <Box align="center" gap={2}>
              <Typography
                className="tw:text-primary"
                size="text-xs"
                weight="semibold">
                {group.title}
              </Typography>
              <Typography className="tw:text-quaternary" size="text-sm">
                {group.items.length === 1
                  ? t('label.one-update')
                  : t('label.number-update-plural', {
                      number: group.items.length,
                    })}
              </Typography>
              <span className="tw:h-px tw:flex-1 tw:bg-border-secondary" />
            </Box>
            {group.items.map((item) => {
              const itemId = item.activity?.id ?? item.feed?.id;

              return (
                <ActivityFeedItem
                  activity={item.activity}
                  feed={item.feed}
                  key={itemId}
                  timeFormat={timeFormat}
                />
              );
            })}
          </Box>
        ))}
        {hasMore && (
          <div
            aria-hidden
            className="tw:h-px"
            data-testid="inbox-activity-sentinel"
            ref={sentinelRef}
          />
        )}
      </Box>
    );
  }

  return (
    <Box className="tw:flex tw:h-full tw:min-h-0" direction="col">
      {/* Lifts with a shadow once the feed scrolls under it. */}
      <div
        className={classNames(
          'tw:relative tw:z-10 tw:py-3 tw:transition-shadow',
          isScrolled && 'tw:shadow-sm'
        )}>
        <div className="tw:mx-auto tw:w-full tw:max-w-220">
          <ActivityToolbar
            datePreset={dateRange?.key ?? DEFAULT_INBOX_DATE_PRESET}
            filter={filter}
            grouping={grouping}
            typeKeys={typeKeys}
            onDatePresetChange={onDatePresetChange}
            onFilterChange={setFilter}
            onGroupingChange={setGrouping}
            onTypeKeysChange={setTypeKeys}
          />
        </div>
      </div>
      <div
        className="tw:relative tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:pt-1 tw:pb-4 tw:pr-1"
        data-testid="inbox-activity-tab"
        ref={scrollRef}
        onScroll={onScroll}>
        <div className="tw:mx-auto tw:w-full tw:max-w-220">
          {activityContent}
        </div>
      </div>
    </Box>
  );
};

export default ActivityTab;
