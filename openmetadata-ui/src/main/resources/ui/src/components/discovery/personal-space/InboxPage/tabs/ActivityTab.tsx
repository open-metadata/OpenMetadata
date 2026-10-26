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

import { Box, Typography } from '@openmetadata/ui-core-components';
import {
  FilterFunnel01,
  Hourglass01,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import { countBy, groupBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PermissionPlaceholder from '../../../../../components/common/EmptyPlaceholder/PermissionPlaceholder';
import SomethingWentWrongPlaceholder from '../../../../../components/common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { ClientErrors } from '../../../../../enums/Axios.enum';
import { User } from '../../../../../generated/entity/teams/user';
import { useViewedUserFirstName } from '../../../../../hooks/discovery/personal-space/useViewedUserFirstName';
import { usePersonalSpaceStore } from '../../../../../hooks/usePersonalSpaceStore';
import { formatDate } from '../../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import searchClassBase from '../../../../../utils/SearchClassBase';
import NoDataPlaceholder from '../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import NoFilteredResultsPlaceholder from '../../../../common/EmptyPlaceholder/NoFilteredResultsPlaceholder';
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
  getDefaultInboxDateRange,
  getInboxDateRange,
  InboxDateRange,
  INBOX_DATE_RANGE_OPTIONS,
  INBOX_ENTITY_ICON_CLASS,
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
    <span className={INBOX_ENTITY_ICON_CLASS}>
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

// A failed feed says so; an empty one says whether the filters emptied it.
const ActivityEmptyState = ({
  error,
  isFiltered,
  userFirstName,
  onRetry,
}: {
  error: unknown;
  isFiltered: boolean;
  // Set when the feed is another user's, so the empty state names them.
  userFirstName?: string;
  onRetry: () => void;
}) => {
  const { t } = useTranslation();

  if (error) {
    return (error as AxiosError)?.response?.status ===
      ClientErrors.FORBIDDEN ? (
      <PermissionPlaceholder
        permissionValue={t('label.view-entity', {
          entity: t('label.activity'),
        })}
      />
    ) : (
      <SomethingWentWrongPlaceholder
        description={t('server.entity-fetch-error', {
          entity: t('label.activity'),
        })}
        onReload={onRetry}
      />
    );
  }

  return isFiltered ? (
    <NoFilteredResultsPlaceholder
      data-testid="inbox-activity-no-results"
      description={t('message.activity-feed-no-results-description')}
      icon={<FilterFunnel01 className="tw:size-7" />}
      title={t('label.no-activity-in-period')}
    />
  ) : (
    <NoDataPlaceholder
      data-testid="inbox-activity-empty"
      description={
        userFirstName
          ? t('message.user-activity-empty-description', {
              name: userFirstName,
            })
          : t('message.activity-feed-empty-description')
      }
      icon={<Hourglass01 className="tw:size-7 tw:text-utility-brand-600" />}
      title={
        userFirstName
          ? t('label.no-activity-yet')
          : t('label.activity-feed-starts-here')
      }
    />
  );
};

export interface ActivityTabProps {
  // Without one the tab keeps its own window, starting at the default preset.
  dateRange?: InboxDateRange;
  onDatePresetChange?: (key: string) => void;
  // Narrowed window → empty reads as "no activity in period" vs first-run state.
  isFiltered?: boolean;
  // Show this user's feeds instead of the viewer's. Likes and replies still
  // act as the viewer.
  user?: User;
}

const getDefaultDateRange = (): InboxDateRange => ({
  ...getDefaultInboxDateRange(),
  key: DEFAULT_INBOX_DATE_PRESET,
});

// The parent's window when it passes one, else the tab's own.
const useActivityDateRange = ({
  dateRange,
  isFiltered = false,
  onDatePresetChange,
}: Pick<
  ActivityTabProps,
  'dateRange' | 'isFiltered' | 'onDatePresetChange'
>) => {
  const [ownDateRange, setOwnDateRange] = useState(getDefaultDateRange);
  const handleOwnDatePresetChange = useCallback(
    (key: string) =>
      setOwnDateRange({
        ...getInboxDateRange(INBOX_DATE_RANGE_OPTIONS[key].days),
        key,
      }),
    []
  );

  return dateRange
    ? { dateRange, isFiltered, onDatePresetChange }
    : {
        dateRange: ownDateRange,
        isFiltered:
          isFiltered || ownDateRange.key !== DEFAULT_INBOX_DATE_PRESET,
        onDatePresetChange: handleOwnDatePresetChange,
      };
};

interface ActivityGroup {
  key: string;
  first: InboxActivityItem;
  title: string;
  items: InboxActivityItem[];
  total: number;
}

// The loaded feed, one block per group, with the incremental-render sentinel.
const ActivityGroupList = ({
  groups,
  GroupIcon,
  mentionedIds,
  userFirstName,
  timeFormat,
  hasMore,
  sentinelRef,
}: {
  groups: ActivityGroup[];
  GroupIcon?: React.FC<{ item: InboxActivityItem }>;
  mentionedIds: Set<string>;
  userFirstName?: string;
  timeFormat: string;
  hasMore: boolean;
  sentinelRef: React.RefObject<HTMLDivElement>;
}) => {
  const { t } = useTranslation();

  return (
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
                mentionedName={userFirstName}
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
};

const ActivityTab: React.FC<ActivityTabProps> = ({ user, ...windowProps }) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState(ActivityFilter.All);
  const [grouping, setGrouping] = useState(ActivityGrouping.Day);
  const [typeKeys, setTypeKeys] = useState<string[]>([]);
  // The Inbox centres a reading column; a user's profile tab spans its panel.
  const feedColumnClass = classNames(
    'tw:mx-auto tw:w-full',
    !user && 'tw:max-w-230'
  );
  const markInboxActivitySeen = usePersonalSpaceStore(
    (s) => s.markInboxActivitySeen
  );
  const { dateRange, isFiltered, onDatePresetChange } =
    useActivityDateRange(windowProps);
  const userFirstName = useViewedUserFirstName(user);
  const isOtherUser = Boolean(userFirstName);
  const userId = user?.id;

  // Looking at the list is what clears the sidebar's unread badge; feeds have no
  // server-side read state to update. Another user's feed is not the inbox.
  useEffect(() => {
    if (!isOtherUser) {
      markInboxActivitySeen();
    }
  }, [isOtherUser, markInboxActivitySeen]);

  // Shared with the badge (one fetch); merge semantics documented on the hook.
  const { items, isLoading, error, refetch } = useInboxActivity(
    filter,
    dateRange,
    userId
  );
  const counts = useInboxActivityCounts(dateRange, userId);
  // The Mentions feed (already read for its count) marks the cards that name
  // the feed's user, whichever tab they appear under.
  const { items: mentionItems } = useInboxActivity(
    ActivityFilter.Mentions,
    dateRange,
    userId
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

  let activityContent: React.ReactNode;
  if (isLoading) {
    activityContent = <ActivitySkeleton />;
  } else if (error || filteredItems.length === 0) {
    activityContent = (
      <ActivityEmptyState
        error={error}
        isFiltered={Boolean(isFiltered || typeKeys.length)}
        userFirstName={userFirstName}
        onRetry={refetch}
      />
    );
  } else {
    activityContent = (
      <ActivityGroupList
        GroupIcon={GroupIcon}
        groups={groups}
        hasMore={hasMore}
        mentionedIds={mentionedIds}
        sentinelRef={sentinelRef}
        timeFormat={timeFormat}
        userFirstName={userFirstName}
      />
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
        <div className={feedColumnClass}>
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
        <div className={feedColumnClass}>{activityContent}</div>
      </div>
    </Box>
  );
};

export default ActivityTab;
