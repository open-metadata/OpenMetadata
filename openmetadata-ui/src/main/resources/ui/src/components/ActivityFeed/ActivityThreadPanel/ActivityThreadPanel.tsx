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

import { Tabs } from '@openmetadata/ui-core-components';
import { Drawer } from 'antd';
import classNames from 'classnames';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelTab } from '../../../constants/Feeds.constants';
import { ActivityThreadPanelProp } from './ActivityThreadPanel.interface';
import ActivityThreadPanelBody from './ActivityThreadPanelBody';

const ActivityThreadPanel: FC<ActivityThreadPanelProp> = ({
  threadLink,
  className,
  onCancel,
  open,
  initialView = 'conversations',
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PanelTab>(
    initialView === 'conversations' ? PanelTab.CONVERSATIONS : PanelTab.TASKS
  );

  const onTabChange = (key: string) => {
    setActiveTab(key as PanelTab);
  };

  useEffect(() => {
    setActiveTab(
      initialView === 'conversations' ? PanelTab.CONVERSATIONS : PanelTab.TASKS
    );
  }, [initialView]);

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
          className="tw:gap-4"
          selectedKey={activeTab}
          onSelectionChange={(key) => onTabChange(String(key))}>
          <Tabs.List className="tw:gap-8 tw:px-4" size="sm" type="underline">
            <Tabs.Item id={PanelTab.TASKS}>{t('label.task-plural')}</Tabs.Item>
            <Tabs.Item id={PanelTab.CONVERSATIONS}>
              {t('label.conversation-plural')}
            </Tabs.Item>
          </Tabs.List>
          <Tabs.Panel id={PanelTab.TASKS}>
            <ActivityThreadPanelBody
              threadLink={threadLink}
              view="tasks"
              onCancel={onCancel}
            />
          </Tabs.Panel>
          <Tabs.Panel id={PanelTab.CONVERSATIONS}>
            <ActivityThreadPanelBody
              threadLink={threadLink}
              view="conversations"
              onCancel={onCancel}
            />
          </Tabs.Panel>
        </Tabs>
      </div>
    </Drawer>
  );
};

export default ActivityThreadPanel;
