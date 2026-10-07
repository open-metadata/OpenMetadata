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
import { useParams } from 'react-router-dom';
import { useIsAiMode } from '../../../hooks/useAppMode';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import {
  ActivityFeedTabProps,
  ActivityFeedTabs,
} from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import ActivityFeed from './ActivityFeed';

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
  const { subTab } = useParams<{ subTab?: string }>();
  const { onUpdateEntityDetails, onFeedUpdate } = tabProps;

  // A resolved task can change the entity (an approved description, a new
  // owner) and moves the tab's count.
  const handleTaskChange = useCallback(() => {
    onUpdateEntityDetails?.();
    onFeedUpdate();
  }, [onUpdateEntityDetails, onFeedUpdate]);

  // The link is empty until the page has read its entity.
  return isAiMode && entityLink ? (
    <ActivityFeed
      defaultView={subTab === ActivityFeedTabs.TASKS ? 'tasks' : 'activity'}
      entityLink={entityLink}
      onTaskChange={handleTaskChange}
    />
  ) : (
    <ActivityFeedTab {...tabProps} />
  );
};

export default ActivityFeedEntityTab;
