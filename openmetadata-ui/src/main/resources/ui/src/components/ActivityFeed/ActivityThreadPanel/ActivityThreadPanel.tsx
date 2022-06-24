/*
 *  Copyright 2021 Collate
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

import { Tabs } from 'antd';
import classNames from 'classnames';
import React, { FC, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { ThreadType } from '../../../generated/entity/feed/thread';
import FeedPanelOverlay from '../ActivityFeedPanel/FeedPanelOverlay';
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
}) => {
  const { TabPane } = Tabs;
  const [activeTab, setActiveTab] = useState<string>('1');

  const onTabChange = (key: string) => {
    setActiveTab(key);
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
  }, []);

  return ReactDOM.createPortal(
    <div className={classNames('tw-h-full', className)}>
      <FeedPanelOverlay
        className="tw-z-9997 tw-fixed tw-inset-0 tw-top-16 tw-h-full tw-w-3/5 tw-bg-black tw-opacity-40"
        onCancel={() => onCancel && onCancel()}
      />
      <div
        className={classNames(
          'tw-top-16 tw-right-0 tw-bottom-0 tw-w-2/5 tw-bg-white tw-fixed tw-shadow-md tw-transform tw-ease-in-out tw-duration-1000 tw-overflow-y-auto tw-z-9997',
          {
            'tw-translate-x-0': open,
            'tw-translate-x-full': !open,
          }
        )}
        id="thread-panel">
        <Tabs
          activeKey={activeTab}
          className="ant-tabs-custom-line ant-tabs-custom-threadpanel"
          onChange={onTabChange}>
          <TabPane key="1" tab="Tasks">
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
          <TabPane key="2" tab="Conversations">
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
    </div>,
    document.body
  );
};

export default ActivityThreadPanel;
