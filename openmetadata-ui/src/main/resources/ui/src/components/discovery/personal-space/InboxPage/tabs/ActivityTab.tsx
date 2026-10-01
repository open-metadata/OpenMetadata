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

import { Box, EmptyPlaceholder } from '@openmetadata/ui-core-components';
import { FilterFunnel01, Hourglass01 } from '@untitledui/icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePersonalSpaceStore } from '../../../../../hooks/usePersonalSpaceStore';
import ActivityDetailDrawer from '../components/ActivityDetailDrawer';
import ActivityFeedItem, {
  ActivityFeedItemSelection,
} from '../components/ActivityFeedItem';
import ActivitySkeleton from '../components/ActivitySkeleton';
import { InboxDateRange, InboxScope } from '../inbox.utils';
import { useInboxActivity } from '../useInboxActivity';
import { useIncrementalRender } from '../useIncrementalRender';

// Cards rendered per batch. The feed is fetched whole (up to ACTIVITY_LIMIT),
// but mounting all of it made opening the detail drawer block for a second.
const ACTIVITY_RENDER_BATCH = 40;

export interface ActivityTabProps {
  // Admin ("all") widens the conversation fallback; "me" scopes it to the user.
  scope?: InboxScope;
  dateRange?: InboxDateRange;
  // Narrowed window → empty reads as "no activity in period" vs first-run state.
  isFiltered?: boolean;
  onCountChange?: (count: number) => void;
}

const ActivityTab: React.FC<ActivityTabProps> = ({
  scope = 'all',
  dateRange,
  isFiltered = false,
  onCountChange,
}) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ActivityFeedItemSelection>();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const markInboxActivitySeen = usePersonalSpaceStore(
    (s) => s.markInboxActivitySeen
  );

  // Looking at the list is what clears the sidebar's unread badge; feeds have no
  // server-side read state to update.
  useEffect(() => {
    markInboxActivitySeen();
  }, [markInboxActivitySeen]);

  // Shared with the badge (one fetch); merge semantics documented on the hook.
  const { items, total, isLoading, refetch } = useInboxActivity(
    scope,
    dateRange
  );

  useEffect(() => {
    onCountChange?.(total);
  }, [total, onCountChange]);

  const { visibleItems, hasMore, scrollRef, sentinelRef } =
    useIncrementalRender(
      items,
      ACTIVITY_RENDER_BATCH,
      `${scope}:${dateRange?.startTs}:${dateRange?.endTs}`
    );

  const handleSelect = useCallback((selection: ActivityFeedItemSelection) => {
    setSelected(selection);
    setIsDrawerOpen(true);
  }, []);

  const selectedId = selected?.activity?.id ?? selected?.feed?.id;

  const emptyPlaceholder = isFiltered ? (
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
  } else if (items.length === 0) {
    activityContent = emptyPlaceholder;
  } else {
    activityContent = (
      <Box
        className="tw:mx-auto tw:w-full tw:max-w-220"
        direction="col"
        gap={3}>
        {visibleItems.map((item) => {
          const itemId = item.activity?.id ?? item.feed?.id;

          return (
            <ActivityFeedItem
              activity={item.activity}
              feed={item.feed}
              isActive={isDrawerOpen && selectedId === itemId}
              key={itemId}
              onClick={handleSelect}
            />
          );
        })}
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
    <>
      <Box className="tw:flex tw:h-full tw:min-h-0" direction="col">
        <div
          className="tw:relative tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:pt-4 tw:pr-1"
          data-testid="inbox-activity-tab"
          ref={scrollRef}>
          {activityContent}
        </div>
      </Box>

      <ActivityDetailDrawer
        activity={selected?.activity}
        feed={selected?.feed}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onPosted={refetch}
      />
    </>
  );
};

export default ActivityTab;
