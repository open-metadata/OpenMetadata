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

import { Box, Tabs } from '@openmetadata/ui-core-components';
import { DateRangeObject } from 'Models';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../hooks/authHooks';
import { usePersonalSpaceStore } from '../../../../hooks/usePersonalSpaceStore';
import {
  getEndOfDayInMillis,
  getStartOfDayInMillis,
} from '../../../../utils/date-time/DateTimeUtils';
import { PERSONAL_SPACE_ROUTES } from '../personalSpace.constants';
import InboxFilterBar from './components/InboxFilterBar';
import InboxPage from './InboxPage';
import {
  getDefaultInboxDateRange,
  InboxDateRange,
  InboxScope,
} from './inbox.utils';
import ActivityTab from './tabs/ActivityTab';
import TasksTab from './tabs/TasksTab';
import { useInboxCounts } from './useInboxCounts';

export type InboxTabKey = 'activity' | 'tasks';

const DEFAULT_TAB: InboxTabKey = 'activity';

/**
 * The Inbox: the Activity / Triage tabs (with live counts) in the page header,
 * over the active surface. Activity is a dated feed and carries a date filter;
 * Triage is a work queue, so an open task never ages out of it.
 */
const InboxContent: React.FC = () => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Sub-tab derived from path so it's deep-linkable.
  const selectedTab: InboxTabKey =
    pathname === PERSONAL_SPACE_ROUTES.INBOX_TASKS ? 'tasks' : DEFAULT_TAB;

  // Mirrors OSS ActivityFeedTab: activity is always the current user's own
  // events; only the conversation fallback widens for admins (every
  // conversation) vs. everyone else (owned/followed threads).
  const effectiveScope: InboxScope = isAdminUser ? 'all' : 'me';

  const defaultDateRange = useMemo(
    () =>
      ({ ...getDefaultInboxDateRange(), key: 'last30days' } as DateRangeObject),
    []
  );

  const storedDateRange = usePersonalSpaceStore((s) => s.inboxDateRange);
  const setInboxDateRange = usePersonalSpaceStore((s) => s.setInboxDateRange);
  const [dateRange, setDateRange] = useState<InboxDateRange>(
    storedDateRange ?? defaultDateRange
  );
  // Tracks whether the active window differs from the default 30-day range, so
  // an empty Activity feed can show the "no results" vs first-run empty state.
  // Compare on the preset key (not timestamps, which drift between mounts).
  const [isDateFiltered, setIsDateFiltered] = useState<boolean>(
    Boolean(storedDateRange) && storedDateRange?.key !== defaultDateRange.key
  );

  // Counts come from a shared fetch (not the mounted tab) so both tab badges
  // stay accurate when switching between Activity and Tasks.
  const { activityCount, taskCount } = useInboxCounts(
    effectiveScope,
    dateRange
  );

  const handleDateRangeChange = useCallback(
    (value: DateRangeObject) => {
      const nextRange: InboxDateRange = {
        startTs: getStartOfDayInMillis(value.startTs),
        endTs: getEndOfDayInMillis(value.endTs),
        key: value.key,
        title: value.title,
      };
      setDateRange(nextRange);
      setInboxDateRange(nextRange);
      setIsDateFiltered(value.key !== defaultDateRange.key);
    },
    [setInboxDateRange, defaultDateRange.key]
  );

  const onTabChange = useCallback(
    (key: React.Key) => {
      navigate(
        (key as InboxTabKey) === 'tasks'
          ? PERSONAL_SPACE_ROUTES.INBOX_TASKS
          : PERSONAL_SPACE_ROUTES.INBOX_ACTIVITY
      );
    },
    [navigate]
  );

  const tabs = (
    <Tabs
      className="tw:mt-3"
      selectedKey={selectedTab}
      onSelectionChange={onTabChange}>
      <Tabs.List size="sm" type="underline">
        <Tabs.Item
          badge={activityCount || undefined}
          id="activity"
          label={t('label.activity')}
        />
        <Tabs.Item
          badge={taskCount || undefined}
          id="tasks"
          label={t('label.triage')}
        />
      </Tabs.List>
    </Tabs>
  );

  const content =
    selectedTab === 'tasks' ? (
      <TasksTab />
    ) : (
      <Box
        className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:px-3"
        direction="col">
        <InboxFilterBar
          dateRange={dateRange}
          defaultDateRange={defaultDateRange}
          onDateRangeChange={handleDateRangeChange}
        />
        <ActivityTab
          dateRange={dateRange}
          isFiltered={isDateFiltered}
          scope={effectiveScope}
        />
      </Box>
    );

  return (
    <InboxPage
      content={
        <Box
          className="ai-inbox-content tw:flex tw:h-full tw:min-h-0 tw:flex-col"
          data-testid="inbox-content"
          direction="col">
          {content}
        </Box>
      }
      tabs={tabs}
    />
  );
};

export default InboxContent;
