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

import { Drawer, Tabs } from 'antd';
import classNames from 'classnames';
import { isEqual } from 'lodash';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelTab } from '../../../constants/Feeds.constants';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { ActivityThreadPanelProp } from './ActivityThreadPanel.interface';
import ActivityThreadPanelBody from './ActivityThreadPanelBody';

const ActivityThreadPanel: FC<ActivityThreadPanelProp> = ({
  threadLink,
  className,
  onCancel,
  open,
  postFeedHandler,
  createThread,
  deletePostHandler,
  updateThreadHandler,
  threadType,
}) => {
  const { t } = useTranslation();
  const { TabPane } = Tabs;
  const [activeTab, setActiveTab] = useState<PanelTab>(PanelTab.TASKS);

  const onTabChange = (key: string) => {
    setActiveTab(key as PanelTab);
  };

  useEffect(() => {
    if (isEqual(threadType, ThreadType.Conversation)) {
      setActiveTab(PanelTab.CONVERSATIONS);
    }
  }, [threadType]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
  }, []);

  return (
    <Drawer
      className={classNames('feed-drawer', className)}
      closable={false}
      open={open}
      width={576}
      onClose={onCancel}>
      <div id="thread-panel">
        <Tabs
          activeKey={activeTab}
          className="ant-tabs-custom-line ant-tabs-custom-threadpanel"
          onChange={onTabChange}>
          <TabPane key={PanelTab.TASKS} tab={t('label.task-plural')}>
            <ActivityThreadPanelBody
              createThread={createThread}
              deletePostHandler={deletePostHandler}
              postFeedHandler={postFeedHandler}
              threadLink={threadLink}
              threadType={ThreadType.Task}
              updateThreadHandler={updateThreadHandler}
              onCancel={onCancel}
            />
          </TabPane>
          <TabPane
            key={PanelTab.CONVERSATIONS}
            tab={t('label.conversation-plural')}>
            <ActivityThreadPanelBody
              createThread={createThread}
              deletePostHandler={deletePostHandler}
              postFeedHandler={postFeedHandler}
              threadLink={threadLink}
              threadType={ThreadType.Conversation}
              updateThreadHandler={updateThreadHandler}
              onCancel={onCancel}
            />
          </TabPane>
        </Tabs>
      </div>
    </Drawer>
  );
};

export default ActivityThreadPanel;
