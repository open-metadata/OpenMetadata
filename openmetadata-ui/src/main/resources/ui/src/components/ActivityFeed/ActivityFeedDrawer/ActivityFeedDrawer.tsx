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

import { Col, Drawer, Row } from 'antd';
import classNames from 'classnames';
import { FC, useMemo } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { TaskTabNew } from '../../Entity/Task/TaskTab/TaskTabNew.component';
import ActivityPanelBody from '../ActivityFeedPanel/ActivityPanelBody';
import ActivityPanelHeader from '../ActivityFeedPanel/ActivityPanelHeader';
import FeedPanelBodyV1 from '../ActivityFeedPanel/FeedPanelBodyV1';
import FeedPanelHeader from '../ActivityFeedPanel/FeedPanelHeader';
import TaskPanelHeader from '../ActivityFeedPanel/TaskPanelHeader';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './activity-feed-drawer.less';

interface ActivityFeedDrawerProps {
  open?: boolean;
  className?: string;
}

const ActivityFeedDrawer: FC<ActivityFeedDrawerProps> = ({
  open,
  className,
}) => {
  const { hideDrawer, selectedThread, selectedTask, selectedActivity } =
    useActivityFeedProvider();

  const entityType = useMemo(() => {
    if (selectedTask?.about?.type) {
      return selectedTask.about.type as EntityType;
    }

    return EntityType.TABLE;
  }, [selectedTask]);

  if (!selectedThread && !selectedTask && !selectedActivity) {
    return null;
  }

  if (selectedTask) {
    return (
      <Drawer
        className={classNames('activity-feed-drawer', className)}
        closable={false}
        open={open}
        title={
          <TaskPanelHeader
            className="p-x-md"
            task={selectedTask}
            onCancel={hideDrawer}
          />
        }
        width={576}
        onClose={hideDrawer}>
        <Row gutter={[0, 16]} id="feed-panel">
          <Col span={24}>
            <TaskTabNew
              isForFeedTab
              isOpenInDrawer
              entityType={entityType}
              task={selectedTask}
            />
          </Col>
        </Row>
      </Drawer>
    );
  }

  if (selectedActivity) {
    return (
      <Drawer
        className={classNames('activity-feed-drawer', className)}
        closable={false}
        open={open}
        title={
          <ActivityPanelHeader
            activity={selectedActivity}
            className="p-x-md"
            onCancel={hideDrawer}
          />
        }
        width={576}
        onClose={hideDrawer}>
        <Row gutter={[0, 16]} id="feed-panel">
          <Col span={24}>
            <ActivityPanelBody activity={selectedActivity} />
          </Col>
        </Row>
      </Drawer>
    );
  }

  return (
    <Drawer
      className={classNames('activity-feed-drawer', className)}
      closable={false}
      open={open}
      title={
        <FeedPanelHeader
          className="p-x-md"
          entityLink={selectedThread?.about ?? ''}
          feed={selectedThread!}
          threadType={selectedThread?.type ?? ThreadType.Conversation}
          onCancel={hideDrawer}
        />
      }
      width={576}
      onClose={hideDrawer}>
      <Row gutter={[0, 16]} id="feed-panel">
        <Col span={24}>
          <FeedPanelBodyV1
            isForFeedTab
            isOpenInDrawer
            showThread
            feed={selectedThread!}
          />
        </Col>
      </Row>
    </Drawer>
  );
};

export default ActivityFeedDrawer;
