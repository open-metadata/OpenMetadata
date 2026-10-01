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

import { Badge, Box, Tabs } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePersonalSpaceStore } from '../../../../hooks/usePersonalSpaceStore';
import { PERSONAL_SPACE_ROUTES } from '../personalSpace.constants';
import {
  DEFAULT_INBOX_DATE_PRESET,
  getDefaultInboxDateRange,
  getInboxDateRange,
  InboxDateRange,
  INBOX_DATE_RANGE_OPTIONS,
} from './inbox.utils';
import InboxPage from './InboxPage';
import ActivityTab from './tabs/ActivityTab';
import TasksTab from './tabs/TasksTab';
import { useInboxCounts } from './useInboxCounts';

export type InboxTabKey = 'activity' | 'tasks';

const DEFAULT_TAB: InboxTabKey = 'activity';

// A soft pill with no outline, brand-tinted on the selected tab. The tab's own
// `badge` prop draws an outlined pill, so the count is rendered here instead.
const renderTabLabel = (label: string, count: number) =>
  function TabLabel({ isSelected }: { isSelected: boolean }) {
    return (
      <>
        {label}
        {count > 0 && (
          <Badge
            bordered={false}
            className={classNames(
              'tw:px-2.5',
              !isSelected && 'tw:bg-utility-gray-100'
            )}
            color={isSelected ? 'brand' : 'gray'}
            size="sm"
            type="pill-color">
            {count}
          </Badge>
        )}
      </>
    );
  };

/**
 * The Inbox: the Activity / Triage tabs (with live counts) in the page header,
 * over the active surface. Activity is a dated feed and carries a date filter;
 * Triage is a work queue, so an open task never ages out of it.
 */
const InboxContent: React.FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Sub-tab derived from path so it's deep-linkable.
  const selectedTab: InboxTabKey =
    pathname === PERSONAL_SPACE_ROUTES.INBOX_TASKS ? 'tasks' : DEFAULT_TAB;

  const storedDateRange = usePersonalSpaceStore((s) => s.inboxDateRange);
  const setInboxDateRange = usePersonalSpaceStore((s) => s.setInboxDateRange);
  const [dateRange, setDateRange] = useState<InboxDateRange>(
    () =>
      storedDateRange ?? {
        ...getDefaultInboxDateRange(),
        key: DEFAULT_INBOX_DATE_PRESET,
      }
  );
  // A narrowed window turns an empty feed into "no activity in this period".
  // Compared on the preset key: timestamps drift between mounts.
  const isDateFiltered = dateRange.key !== DEFAULT_INBOX_DATE_PRESET;

  // Counts come from a shared fetch (not the mounted tab) so both tab badges
  // stay accurate when switching between Activity and Tasks.
  const { activityCount, taskCount } = useInboxCounts(dateRange);

  const handleDatePresetChange = useCallback(
    (key: string) => {
      const nextRange: InboxDateRange = {
        ...getInboxDateRange(INBOX_DATE_RANGE_OPTIONS[key].days),
        key,
      };
      setDateRange(nextRange);
      setInboxDateRange(nextRange);
    },
    [setInboxDateRange]
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
      {/* The header's bottom border is the rule under these tabs; the list's
          own separator would draw a second, shorter line right above it. */}
      <Tabs.List className="tw:before:hidden" size="sm" type="underline">
        <Tabs.Item id="activity">
          {renderTabLabel(t('label.activity'), activityCount)}
        </Tabs.Item>
        <Tabs.Item id="tasks">
          {renderTabLabel(t('label.triage'), taskCount)}
        </Tabs.Item>
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
        <ActivityTab
          dateRange={dateRange}
          isFiltered={isDateFiltered}
          onDatePresetChange={handleDatePresetChange}
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
