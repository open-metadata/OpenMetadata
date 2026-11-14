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

import {
  SlideoutMenu,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';

import classNames from 'classnames';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FEED_DRAWER_WIDTH,
  PanelTab,
} from '../../../constants/Feeds.constants';
import { useVisitedTabs } from '../../../hooks/useVisitedTabs';
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

  // Keeps an unsent conversation or task draft when switching tabs.
  const visitedTabs = useVisitedTabs(activeTab);

  const onTabChange = (key: string) => {
    setActiveTab(key as PanelTab);
  };

  useEffect(() => {
    setActiveTab(
      initialView === 'conversations' ? PanelTab.CONVERSATIONS : PanelTab.TASKS
    );
  }, [initialView]);

  // Popup portals belong to the drawer even though they render outside its DOM tree.
  return (
    <SlideoutMenu
      isDismissable
      aria-label={t('label.activity-feed')}
      dialogClassName={classNames('feed-drawer', className)}
      isOpen={open}
      shouldCloseOnInteractOutside={(element) =>
        !element.closest('[data-react-aria-top-layer]')
      }
      width={FEED_DRAWER_WIDTH}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel?.();
        }
      }}>
      <SlideoutMenu.Header closeButtonTestId="closeDrawer" onClose={onCancel}>
        <Typography size="text-lg" weight="semibold">
          {t('label.activity-feed')}
        </Typography>
      </SlideoutMenu.Header>
      <SlideoutMenu.Content role="region">
        <div id="thread-panel">
          <Tabs
            className="tw:gap-4"
            selectedKey={activeTab}
            onSelectionChange={(key) => onTabChange(String(key))}>
            <Tabs.List className="tw:gap-8 tw:px-4" size="sm" type="underline">
              <Tabs.Item id={PanelTab.TASKS}>
                {t('label.task-plural')}
              </Tabs.Item>
              <Tabs.Item id={PanelTab.CONVERSATIONS}>
                {t('label.conversation-plural')}
              </Tabs.Item>
            </Tabs.List>
            <Tabs.Panel
              className="tw:data-inert:hidden"
              id={PanelTab.TASKS}
              shouldForceMount={visitedTabs.has(PanelTab.TASKS)}>
              <ActivityThreadPanelBody
                threadLink={threadLink}
                view="tasks"
                onCancel={onCancel}
              />
            </Tabs.Panel>
            <Tabs.Panel
              className="tw:data-inert:hidden"
              id={PanelTab.CONVERSATIONS}
              shouldForceMount={visitedTabs.has(PanelTab.CONVERSATIONS)}>
              <ActivityThreadPanelBody
                threadLink={threadLink}
                view="conversations"
                onCancel={onCancel}
              />
            </Tabs.Panel>
          </Tabs>
        </div>
      </SlideoutMenu.Content>
    </SlideoutMenu>
  );
};

export default ActivityThreadPanel;
