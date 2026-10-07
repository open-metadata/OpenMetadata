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
import React, { useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { EntityTabs } from '../../../enums/entity.enum';
import { useIsAiMode } from '../../../hooks/useAppMode';
import EntityLink from '../../../utils/EntityLink';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import {
  ActivityFeedTabProps,
  ActivityFeedTabs,
} from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import ActivityFeed, { ActivityFeedView } from './ActivityFeed';
import { useTaskStatusParam } from './useTaskStatusParam';

export type ActivityFeedEntityTabProps = ActivityFeedTabProps & {
  // The entity the page shows, e.g. `<#E::table::fqn>`.
  entityLink: string;
};

/**
 * An entity page's Activity Feeds & Tasks tab: the Inbox's Activity and Tasks
 * in AI mode, where the new Inbox lives; the existing tab otherwise.
 */
const ActivityFeedEntityTab: React.FC<ActivityFeedEntityTabProps> = ({
  entityLink,
  ...tabProps
}) => {
  const isAiMode = useIsAiMode();
  const navigate = useNavigate();
  const { search } = useLocation();
  const { subTab } = useParams<{ subTab?: string }>();
  // In the URL, so the page's tab label counts the same Status.
  const [taskStatus, setTaskStatus] = useTaskStatusParam();
  const { onUpdateEntityDetails, onFeedUpdate } = tabProps;
  // The route names the view, as it does for today's tab, so a link to
  // …/activity_feed/tasks opens on Tasks and a switch can be shared.
  const view: ActivityFeedView =
    subTab === ActivityFeedTabs.TASKS ? 'tasks' : 'activity';

  const handleViewChange = useCallback(
    (next: ActivityFeedView) =>
      navigate(
        {
          pathname: entityUtilClassBase.getEntityLink(
            EntityLink.getEntityType(entityLink),
            EntityLink.getEntityFqn(entityLink),
            EntityTabs.ACTIVITY_FEED,
            next === 'tasks' ? ActivityFeedTabs.TASKS : ActivityFeedTabs.ALL
          ),
          // Keeps the Tasks Status across the switch.
          search,
        },
        { replace: true }
      ),
    [navigate, entityLink, search]
  );

  // A resolved task can change the entity (an approved description, a new
  // owner) and moves the tab's count.
  const handleTaskChange = useCallback(() => {
    onUpdateEntityDetails?.();
    onFeedUpdate();
  }, [onUpdateEntityDetails, onFeedUpdate]);

  // The link is empty until the page has read its entity.
  return isAiMode && entityLink ? (
    <ActivityFeed
      entityLink={entityLink}
      taskStatus={taskStatus}
      view={view}
      onTaskChange={handleTaskChange}
      onTaskStatusChange={setTaskStatus}
      onViewChange={handleViewChange}
    />
  ) : (
    <ActivityFeedTab {...tabProps} />
  );
};

export default ActivityFeedEntityTab;
