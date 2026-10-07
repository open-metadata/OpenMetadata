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
import {
  FilterFunnel01,
  Hourglass01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import { countBy, groupBy } from 'lodash';
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
  getInboxItemId,
  getInboxItemTimestamp,
  InboxActivityItem,
  useInboxActivity,
  useInboxActivityCounts,
} from '../useInboxActivity';
import { useIncrementalRender } from '../useIncrementalRender';
import { useIsScrolled } from '../useIsScrolled';

// Cards rendered per batch. The feed is fetched whole (up to ACTIVITY_LIMIT),
// but a small DOM keeps a modal over it (a delete confirm, say) cheap to open.
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
    title: (item: InboxActivityItem, t: TFunction) => string;
  }
> = {
  [ActivityGrouping.Day]: {
    key: (item) => formatDate(getInboxItemTimestamp(item)),
    title: (item, t) => getActivityDayLabel(getInboxItemTimestamp(item), t),
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
}

const ActivityTab: React.FC<ActivityTabProps> = ({
  dateRange,
  onDatePresetChange,
  isFiltered = false,
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
  const { items, isLoading } = useInboxActivity(filter, dateRange);
  const counts = useInboxActivityCounts(dateRange);
  // The Mentions feed (already read for its count) marks the cards that name
  // the viewer, whichever tab they appear under.
  const { items: mentionItems } = useInboxActivity(
    ActivityFilter.Mentions,
    dateRange
  );
  const mentionedIds = useMemo(
    () => new Set(mentionItems.map(getInboxItemId)),
    [mentionItems]
  );
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

  const { isScrolled, onScroll } = useIsScrolled();
  // Day groups are chronological, so a new batch only appends below. Asset and
  // User groups would grow above the viewport and jump the page, so they render
  // whole.
  // ponytail: mounts up to ~300 cards when grouped by Asset/User; reveal whole
  // groups a batch at a time if that gets slow.
  const { visibleItems, hasMore, scrollRef, sentinelRef } =
    useIncrementalRender(
      filteredItems,
      grouping === ActivityGrouping.Day ? ACTIVITY_RENDER_BATCH : Infinity,
      `${filter}:${typeKeys}:${dateRange?.startTs}:${dateRange?.endTs}`
    );

  // Groups keep the feed's newest-first order, as does each group's cards. Only
  // the revealed batch renders, but a header counts its whole group.
  const groups = useMemo(() => {
    const { key, title } = GROUPING[grouping];
    const totals = countBy(filteredItems, key);

    return Object.values(groupBy(visibleItems, key)).map((groupItems) => ({
      key: key(groupItems[0]),
      title: title(groupItems[0], t),
      items: groupItems,
      total: totals[key(groupItems[0])],
    }));
  }, [filteredItems, visibleItems, grouping, t]);
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
                {group.total === 1
                  ? t('label.one-update')
                  : t('label.number-update-plural', {
                      number: group.total,
                    })}
              </Typography>
              <span className="tw:h-px tw:flex-1 tw:bg-border-secondary" />
            </Box>
            {group.items.map((item) => {
              const itemId = getInboxItemId(item);

              return (
                <ActivityFeedItem
                  activity={item.activity}
                  feed={item.feed}
                  isMentioned={mentionedIds.has(itemId)}
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
      {/* Lifts with a shadow once the feed scrolls under it. The negative
          margin cancels the panel's gutter so the shadow spans edge to edge,
          and shadow-md's negative spread keeps it under the bar only. */}
      <div
        className={classNames(
          'tw:relative tw:z-10 tw:-mx-3 tw:px-3 tw:py-3 tw:transition-shadow',
          isScrolled && 'tw:shadow-md'
        )}>
        <div className="tw:mx-auto tw:w-full tw:max-w-220">
          <ActivityToolbar
            counts={counts}
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
      {/* A gutter on both edges keeps the feed centred under the toolbar while
          the scrollbar shows. */}
      <div
        className="tw:relative tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:pt-5 tw:pb-4 tw:[scrollbar-gutter:stable_both-edges]"
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
