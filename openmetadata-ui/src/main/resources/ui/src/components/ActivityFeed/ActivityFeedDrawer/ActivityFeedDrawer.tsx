/*
 *  Copyright 2022 Collate.
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

import { SlideoutMenu } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { FC, lazy, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import ActivityPanelBody from '../ActivityFeedPanel/ActivityPanelBody';
import ActivityPanelHeader from '../ActivityFeedPanel/ActivityPanelHeader';
import FeedPanelBodyV1 from '../ActivityFeedPanel/FeedPanelBodyV1';
import FeedPanelHeader from '../ActivityFeedPanel/FeedPanelHeader';
import TaskPanelHeader from '../ActivityFeedPanel/TaskPanelHeader';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './activity-feed-drawer.less';

const ACTIVITY_FEED_DRAWER_CLASS = 'activity-feed-drawer';
const DRAWER_WIDTH = 576;

const TaskTabNew = withSuspenseFallback(
  lazy(() =>
    import('../../Entity/Task/TaskTab/TaskTabNew.component').then((m) => ({
      default: m.TaskTabNew,
    }))
  )
);

interface ActivityFeedDrawerProps {
  open?: boolean;
  className?: string;
}

const ActivityFeedDrawer: FC<ActivityFeedDrawerProps> = ({
  open,
  className,
}) => {
  const { t } = useTranslation();
  const { hideDrawer, selectedThread, selectedTask, selectedActivity } =
    useActivityFeedProvider();

  const entityType = useMemo(() => {
    if (selectedTask?.about?.type) {
      return selectedTask.about.type as EntityType;
    }

    return EntityType.TABLE;
  }, [selectedTask]);

  const panel = useMemo((): { header: ReactNode; body: ReactNode } | null => {
    if (selectedTask) {
      return {
        header: (
          <TaskPanelHeader
            className="p-x-md"
            task={selectedTask}
            onCancel={hideDrawer}
          />
        ),
        body: (
          <TaskTabNew
            isForFeedTab
            isOpenInDrawer
            entityType={entityType}
            task={selectedTask}
          />
        ),
      };
    }

    if (selectedActivity) {
      return {
        header: (
          <ActivityPanelHeader
            activity={selectedActivity}
            className="p-x-md"
            onCancel={hideDrawer}
          />
        ),
        body: <ActivityPanelBody activity={selectedActivity} />,
      };
    }

    if (selectedThread) {
      return {
        header: (
          <FeedPanelHeader
            className="p-x-md"
            entityLink={selectedThread.about ?? ''}
            feed={selectedThread}
            onCancel={hideDrawer}
          />
        ),
        body: (
          <FeedPanelBodyV1
            isForFeedTab
            isOpenInDrawer
            showThread
            feed={selectedThread}
          />
        ),
      };
    }

    return null;
  }, [selectedTask, selectedActivity, selectedThread, entityType, hideDrawer]);

  if (!panel) {
    return null;
  }

  return (
    <SlideoutMenu
      isDismissable
      aria-label={t('label.activity-feed')}
      data-testid="activity-feed-drawer"
      dialogClassName={classNames(
        ACTIVITY_FEED_DRAWER_CLASS,
        'tw:items-stretch tw:gap-0',
        className
      )}
      isOpen={open}
      width={DRAWER_WIDTH}
      onOpenChange={(isOpen) => !isOpen && hideDrawer()}>
      <div className="activity-feed-drawer-header">{panel.header}</div>
      <SlideoutMenu.Content className="activity-feed-drawer-body tw:h-auto tw:gap-0 tw:px-0 tw:md:px-0">
        <div id="feed-panel">{panel.body}</div>
      </SlideoutMenu.Content>
    </SlideoutMenu>
  );
};

export default ActivityFeedDrawer;
