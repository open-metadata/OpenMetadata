/*
 *  Copyright 2023 Collate.
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
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import RecentlyViewed from '../../../components/recently-viewed/RecentlyViewed';
import { Thread } from '../../../generated/entity/feed/thread';
import { WidgetConfig } from '../../../pages/CustomisablePages/CustomisablePage.interface';
import { getActiveAnnouncement } from '../../../rest/feedsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import AnnouncementsWidget from './AnnouncementsWidget';
import FollowingWidget from './FollowingWidget';
import './right-sidebar.less';
import { RightSidebarProps } from './RightSidebar.interface';

const ResponsiveGridLayout = WidthProvider(Responsive);

const RightSidebar = ({
  isEditView = false,
  followedData,
  followedDataCount,
  isLoadingOwnedData,
  layoutConfigData,
}: RightSidebarProps) => {
  const [announcements, setAnnouncements] = useState<Thread[]>([]);

  const getWidgetFromKey = useCallback(
    (widgetConfig: WidgetConfig) => {
      switch (widgetConfig.i) {
        case 'KnowledgePanel.Announcements':
          return (
            <AnnouncementsWidget
              announcements={announcements}
              isEditView={isEditView}
            />
          );

        case 'KnowledgePanel.Following':
          return (
            <FollowingWidget
              followedData={followedData}
              followedDataCount={followedDataCount}
              isEditView={isEditView}
              isLoadingOwnedData={isLoadingOwnedData}
            />
          );

        case 'KnowledgePanel.RecentlyViewed':
          return <RecentlyViewed isEditView={isEditView} />;
        default:
          return;
      }
    },
    [
      announcements,
      followedData,
      followedDataCount,
      isLoadingOwnedData,
      isEditView,
    ]
  );

  const widgets = useMemo(
    () =>
      layoutConfigData?.page?.layout
        .filter((widget: WidgetConfig) =>
          widget.i === 'KnowledgePanel.Announcements'
            ? !isEmpty(announcements)
            : true
        )
        .map((widget: WidgetConfig) => (
          <div data-grid={widget} key={widget.i}>
            {getWidgetFromKey(widget)}
          </div>
        )),
    [layoutConfigData, announcements, getWidgetFromKey]
  );

  useEffect(() => {
    getActiveAnnouncement()
      .then((res) => {
        setAnnouncements(res.data);
      })
      .catch((err) => {
        showErrorToast(err);
      });
  }, []);

  if (isEditView) {
    return (
      <ResponsiveGridLayout
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 1, md: 1, sm: 1, xs: 1, xxs: 1 }}
        draggableHandle=".drag-widget-icon"
        isResizable={false}>
        {widgets}
      </ResponsiveGridLayout>
    );
  }

  return (
    <>
      {!isEmpty(announcements) && (
        <AnnouncementsWidget announcements={announcements} />
      )}
      <FollowingWidget
        followedData={followedData}
        followedDataCount={followedDataCount}
        isLoadingOwnedData={isLoadingOwnedData}
      />
      <RecentlyViewed />
    </>
  );
};

export default RightSidebar;
