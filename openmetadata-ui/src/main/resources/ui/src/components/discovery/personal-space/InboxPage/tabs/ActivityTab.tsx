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
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { usePersonalSpaceStore } from '../../../../../hooks/usePersonalSpaceStore';
import { formatDate } from '../../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import searchClassBase from '../../../../../utils/SearchClassBase';
import {
  ActivityScope,
  getActivityScopeKey,
  INBOX_SCOPE,
  SCOPE_FILTERS,
} from '../activityScope';
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

// An Asset group leads with its asset's icon, a User group with the user.
const AssetGroupIcon = ({ item }: { item: InboxActivityItem }) => {
  const type = getItemEntity(item)?.type;

  return type ? (
    <span className="tw:flex tw:shrink-0 tw:items-center tw:text-fg-quaternary tw:[&_img]:size-4 tw:[&_svg]:size-4">
      {searchClassBase.getEntityIcon(type)}
    </span>
  ) : null;
};

const UserGroupIcon = ({ item }: { item: InboxActivityItem }) => {
  const actor = getItemActor(item);

  return actor?.name ? (
    <ProfilePicture
      borderless
      displayName={getEntityName(actor)}
      name={actor.name}
      size="xs"
    />
  ) : null;
};

// How each grouping keys an item, titles its group and marks its header.
const GROUPING: Record<
  ActivityGrouping,
  {
    key: (item: InboxActivityItem) => string;
    title: (item: InboxActivityItem, t: TFunction) => string;
    Icon?: React.FC<{ item: InboxActivityItem }>;
  }
> = {
  [ActivityGrouping.Day]: {
    key: (item) => formatDate(getInboxItemTimestamp(item)),
    title: (item, t) => getActivityDayLabel(getInboxItemTimestamp(item), t),
  },
  [ActivityGrouping.Asset]: {
    key: (item) => getItemEntity(item)?.id ?? '',
    title: (item) => getEntityName(getItemEntity(item)),
    Icon: AssetGroupIcon,
  },
  [ActivityGrouping.User]: {
    key: (item) => getItemActor(item)?.name ?? '',
    title: (item) => getEntityName(getItemActor(item)),
    Icon: UserGroupIcon,
  },
};

// Looking at the Inbox list is what clears the sidebar's unread badge; feeds
// have no server-side read state to update.
const useMarkInboxSeen = (isInbox: boolean) => {
  const markInboxActivitySeen = usePersonalSpaceStore(
    (s) => s.markInboxActivitySeen
  );

  useEffect(() => {
    if (isInbox) {
      markInboxActivitySeen();
    }
  }, [isInbox, markInboxActivitySeen]);
};

// The Mentions feed (already read for its count) marks the cards that name the
// viewer, whichever feed they appear under. A scope without one reads its
// showing feed instead, the same query, so nothing extra is fetched.
const useMentionedIds = (
  scope: ActivityScope,
  filter: ActivityFilter,
  dateRange?: InboxDateRange
) => {
  const hasMentions = SCOPE_FILTERS[scope.type].includes(
    ActivityFilter.Mentions
  );
  const { items } = useInboxActivity(
    hasMentions ? ActivityFilter.Mentions : filter,
    dateRange,
    scope
  );

  return useMemo(
    () => new Set(hasMentions ? items.map(getInboxItemId) : undefined),
    [hasMentions, items]
  );
};

// Lifts with a shadow once the feed scrolls under it. The negative margin
// cancels the panel's gutter so the shadow spans edge to edge, and shadow-md's
// negative spread keeps it under the bar only. Beside a host's control the bar
// spans the tab; alone it lines up with the feed column.
const ActivityTabHeader = ({
  isScrolled,
  leading,
  children,
}: {
  isScrolled: boolean;
  leading?: ReactNode;
  children: ReactNode;
}) => (
  <div
    className={classNames(
      'tw:relative tw:z-10 tw:-mx-3 tw:px-3 tw:py-3 tw:transition-shadow',
      isScrolled && 'tw:shadow-md'
    )}>
    <div
      className={classNames(
        'tw:w-full',
        !leading && 'tw:mx-auto tw:max-w-230'
      )}>
      {children}
    </div>
  </div>
);

export interface ActivityTabProps {
  dateRange?: InboxDateRange;
  onDatePresetChange?: (key: string) => void;
  // Narrowed window → empty reads as "no activity in period" vs first-run state.
  isFiltered?: boolean;
  // Whose activity; the viewer's Inbox when omitted.
  scope?: ActivityScope;
  // The host's control for the toolbar's left side (an entity's Activity /
  // Tasks switch); the feeds then move into a Show menu.
  leading?: ReactNode;
}

const ActivityTab: React.FC<ActivityTabProps> = ({
  dateRange,
  onDatePresetChange,
  isFiltered = false,
  scope = INBOX_SCOPE,
  leading,
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState(ActivityFilter.All);
  const [grouping, setGrouping] = useState(ActivityGrouping.Day);
  const [typeKeys, setTypeKeys] = useState<string[]>([]);
  const isInbox = scope.type === 'inbox';
  useMarkInboxSeen(isInbox);

  // Shared with the badge (one fetch); merge semantics documented on the hook.
  const { items, isLoading } = useInboxActivity(filter, dateRange, scope);
  const counts = useInboxActivityCounts(dateRange, scope);
  const mentionedIds = useMentionedIds(scope, filter, dateRange);
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
      `${getActivityScopeKey(scope)}:${filter}:${typeKeys}:${
        dateRange?.startTs
      }:${dateRange?.endTs}`
    );

  // Groups keep the feed's newest-first order, as does each group's cards. Only
  // the revealed batch renders, but a header counts its whole group.
  const groups = useMemo(() => {
    const { key, title } = GROUPING[grouping];
    const totals = countBy(filteredItems, key);

    return Object.values(groupBy(visibleItems, key)).map((groupItems) => ({
      key: key(groupItems[0]),
      first: groupItems[0],
      title: title(groupItems[0], t),
      items: groupItems,
      total: totals[key(groupItems[0])],
    }));
  }, [filteredItems, visibleItems, grouping, t]);
  const GroupIcon = GROUPING[grouping].Icon;
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
              {GroupIcon && <GroupIcon item={group.first} />}
              <Typography
                className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-primary"
                size="text-xs"
                weight="semibold">
                {group.title}
              </Typography>
              <Typography
                className="tw:shrink-0 tw:text-quaternary"
                size="text-xs">
                {group.total === 1
                  ? t('label.one-update')
                  : t('label.number-update-plural', {
                      number: group.total,
                    })}
              </Typography>
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
      <ActivityTabHeader isScrolled={isScrolled} leading={leading}>
        <ActivityToolbar
          counts={counts}
          datePreset={dateRange?.key ?? DEFAULT_INBOX_DATE_PRESET}
          filter={filter}
          filters={SCOPE_FILTERS[scope.type]}
          grouping={grouping}
          leading={leading}
          typeKeys={typeKeys}
          onDatePresetChange={onDatePresetChange}
          onFilterChange={setFilter}
          onGroupingChange={isInbox ? setGrouping : undefined}
          onTypeKeysChange={setTypeKeys}
        />
      </ActivityTabHeader>
      {/* A gutter on both edges keeps the feed centred under the toolbar while
          the scrollbar shows. */}
      <div
        className="tw:relative tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:pt-5 tw:pb-4 tw:[scrollbar-gutter:stable_both-edges]"
        data-testid="inbox-activity-tab"
        ref={scrollRef}
        onScroll={onScroll}>
        <div className="tw:mx-auto tw:w-full tw:max-w-230">
          {activityContent}
        </div>
      </div>
    </Box>
  );
};

export default ActivityTab;
