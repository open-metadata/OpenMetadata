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
import React, { useState } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { useIsAiMode } from '../../../hooks/useAppMode';
import { useEntityFeedLink } from '../../../hooks/useEntityFeedLink';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { TabsLabelProps } from '../../common/TabsLabel/TabsLabel.interface';
import { getActivityFeedTabCount } from './ActivityFeed.utils';
import { useActivityDatePresetParam } from './useActivityDatePresetParam';
import { useActivityFeedCounts } from './useActivityFeedCounts';
import { useTaskStatusParam } from './useTaskStatusParam';

export type ActivityFeedTabLabelProps = TabsLabelProps & {
  // The entity the page shows; its FQN comes from the route, else `fqn`.
  entityType: EntityType;
  fqn?: string;
};

const ActivityFeedCountLabel: React.FC<
  TabsLabelProps & { entityLink: string }
> = ({ entityLink, ...labelProps }) => {
  // The window the feed shows, so this reads the queries the feed does.
  const [dateRange] = useActivityDatePresetParam();
  const [taskStatus] = useTaskStatusParam();
  const { activityCount, taskCounts } = useActivityFeedCounts(
    entityLink,
    dateRange
  );
  const taskCount = taskCounts[taskStatus];

  return (
    <TabsLabel
      {...labelProps}
      // Hidden until both counts arrive, and when either read fails.
      count={
        activityCount && taskCount !== undefined
          ? getActivityFeedTabCount(
              activityCount.total + taskCount,
              activityCount.isCapped
            )
          : undefined
      }
    />
  );
};

/**
 * The entity page's Activity Feeds & Tasks tab label. In AI mode the tab is an
 * `<ActivityFeed>`, so once the tab has been opened the label counts what it
 * shows: its Activity and the tasks of the chosen Status. Until then, and
 * outside AI mode, `count`, so a page view that never opens the tab does not
 * read the feed.
 */
const ActivityFeedTabLabel: React.FC<ActivityFeedTabLabelProps> = ({
  entityType,
  fqn,
  ...labelProps
}) => {
  const isAiMode = useIsAiMode();
  const entityLink = useEntityFeedLink(entityType, fqn);
  const [openedLink, setOpenedLink] = useState(
    labelProps.isActive ? entityLink : undefined
  );
  if (labelProps.isActive && openedLink !== entityLink) {
    setOpenedLink(entityLink);
  }

  return isAiMode && entityLink && openedLink === entityLink ? (
    <ActivityFeedCountLabel entityLink={entityLink} {...labelProps} />
  ) : (
    <TabsLabel {...labelProps} />
  );
};

export default ActivityFeedTabLabel;
