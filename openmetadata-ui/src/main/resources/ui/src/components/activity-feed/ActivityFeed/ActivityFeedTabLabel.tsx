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
import React, { useMemo } from 'react';
import { useIsAiMode } from '../../../hooks/useAppMode';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { TabsLabelProps } from '../../common/TabsLabel/TabsLabel.interface';
import { getDefaultInboxDateRange } from '../../discovery/personal-space/InboxPage/inbox.utils';
import { useActivityFeedCounts } from './useActivityFeedCounts';
import { useTaskStatusParam } from './useTaskStatusParam';

export type ActivityFeedTabLabelProps = TabsLabelProps & {
  // The entity the page shows, e.g. `<#E::table::fqn>`.
  entityLink: string;
};

const ActivityFeedCountLabel: React.FC<ActivityFeedTabLabelProps> = ({
  entityLink,
  ...labelProps
}) => {
  // The window the feed opens on, so this reads the queries the feed will.
  const dateRange = useMemo(getDefaultInboxDateRange, []);
  const [taskStatus] = useTaskStatusParam();
  const { activityCount, taskCounts } = useActivityFeedCounts(
    entityLink,
    dateRange
  );

  return (
    <TabsLabel
      {...labelProps}
      // Hidden until the activity arrives, rather than a number that moves.
      count={activityCount && activityCount.total + taskCounts[taskStatus]}
    />
  );
};

/**
 * The entity page's Activity Feeds & Tasks tab label. In AI mode the tab is an
 * `<ActivityFeed>`, so the label counts what it shows: its Activity and the
 * tasks of the chosen Status. Otherwise `count`.
 */
const ActivityFeedTabLabel: React.FC<ActivityFeedTabLabelProps> = ({
  entityLink,
  ...labelProps
}) => {
  const isAiMode = useIsAiMode();

  return isAiMode && entityLink ? (
    <ActivityFeedCountLabel entityLink={entityLink} {...labelProps} />
  ) : (
    <TabsLabel {...labelProps} />
  );
};

export default ActivityFeedTabLabel;
