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
import { isEmpty, isUndefined, uniqBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout, Responsive, WidthProvider } from 'react-grid-layout';
import RecentlyViewed from '../../../components/recently-viewed/RecentlyViewed';
import {
  LANDING_PAGE_RIGHT_CONTAINER_MAX_GRID_SIZE,
  LANDING_PAGE_ROW_HEIGHT,
  LANDING_PAGE_WIDGET_MARGIN,
} from '../../../constants/CustomisePage.constants';
import { SIZE } from '../../../enums/common.enum';
import { LandingPageWidgetKeys } from '../../../enums/CustomizablePage.enum';
import { Document } from '../../../generated/entity/docStore/document';
import { WidgetConfig } from '../../../pages/CustomisablePages/CustomisablePage.interface';
import {
  getAddWidgetHandler,
  getLayoutUpdateHandler,
  getRemoveWidgetHandler,
} from '../../../utils/CustomizableLandingPageUtils';
import AddWidgetModal from '../../CustomizableComponents/AddWidgetModal/AddWidgetModal';
import EmptyWidgetPlaceholder from '../../CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder';
import KPIWidget from '../../KPIWidget/KPIWidget.component';
import { MyDataWidget } from '../MyDataWidget/MyDataWidget.component';
import AnnouncementsWidget from './AnnouncementsWidget';
import FollowingWidget from './FollowingWidget';
import './right-sidebar.less';
import { RightSidebarProps } from './RightSidebar.interface';

const ResponsiveGridLayout = WidthProvider(Responsive);

const RightSidebar = ({
  announcements,
  isAnnouncementLoading,
  parentLayoutData,
  isEditView = false,
  followedData,
  followedDataCount,
  isLoadingOwnedData,
  layoutConfigData,
  updateParentLayout,
}: RightSidebarProps) => {
  const [layout, setLayout] = useState<Array<WidgetConfig>>([
    ...(layoutConfigData?.page?.layout ?? []),
    ...(isEditView
      ? [
          {
            h: 2.3,
            i: 'ExtraWidget.EmptyWidgetPlaceholder',
            w: 1,
            x: 0,
            y: 100,
            isDraggable: false,
          },
        ]
      : []),
  ]);
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState<boolean>(false);

  const handleOpenAddWidgetModal = useCallback(() => {
    setIsWidgetModalOpen(true);
  }, []);

  const handleCloseAddWidgetModal = useCallback(() => {
    setIsWidgetModalOpen(false);
  }, []);

  const handleRemoveWidget = useCallback((widgetKey: string) => {
    setLayout(getRemoveWidgetHandler(widgetKey, 2.3, 2.5));
  }, []);

  const handleAddWidget = useCallback(
    (newWidgetData: Document) => {
      setLayout(getAddWidgetHandler(newWidgetData));
      setIsWidgetModalOpen(false);
    },
    [layout]
  );

  const getWidgetFromKey = useCallback(
    (widgetConfig: WidgetConfig) => {
      if (widgetConfig.i.endsWith('.EmptyWidgetPlaceholder')) {
        return (
          <div className="h-full">
            <EmptyWidgetPlaceholder
              handleOpenAddWidgetModal={handleOpenAddWidgetModal}
              handleRemoveWidget={handleRemoveWidget}
              iconHeight={SIZE.SMALL}
              iconWidth={SIZE.SMALL}
              isEditable={widgetConfig.isDraggable}
              widgetKey={widgetConfig.i}
            />
          </div>
        );
      }

      if (widgetConfig.i.startsWith(LandingPageWidgetKeys.MY_DATA)) {
        return (
          <MyDataWidget
            handleRemoveWidget={handleRemoveWidget}
            isEditView={isEditView}
            widgetKey={widgetConfig.i}
          />
        );
      }

      if (widgetConfig.i.startsWith(LandingPageWidgetKeys.KPI)) {
        return (
          <KPIWidget
            handleRemoveWidget={handleRemoveWidget}
            isEditView={isEditView}
            widgetKey={widgetConfig.i}
          />
        );
      }

      if (widgetConfig.i.startsWith(LandingPageWidgetKeys.ANNOUNCEMENTS)) {
        return (
          <AnnouncementsWidget
            announcements={announcements}
            handleRemoveWidget={handleRemoveWidget}
            isEditView={isEditView}
            widgetKey={widgetConfig.i}
          />
        );
      }

      if (widgetConfig.i.startsWith(LandingPageWidgetKeys.FOLLOWING)) {
        return (
          <FollowingWidget
            followedData={followedData}
            followedDataCount={followedDataCount}
            handleRemoveWidget={handleRemoveWidget}
            isEditView={isEditView}
            isLoadingOwnedData={isLoadingOwnedData}
            widgetKey={widgetConfig.i}
          />
        );
      }

      if (widgetConfig.i.startsWith(LandingPageWidgetKeys.RECENTLY_VIEWED)) {
        return (
          <RecentlyViewed
            handleRemoveWidget={handleRemoveWidget}
            isEditView={isEditView}
            widgetKey={widgetConfig.i}
          />
        );
      }

      return null;
    },
    [
      announcements,
      followedData,
      followedDataCount,
      isLoadingOwnedData,
      isEditView,
      handleRemoveWidget,
      handleOpenAddWidgetModal,
    ]
  );

  const widgets = useMemo(
    () =>
      layout
        .filter((widget: WidgetConfig) =>
          !isAnnouncementLoading &&
          widget.i === LandingPageWidgetKeys.ANNOUNCEMENTS &&
          !isEditView
            ? !isEmpty(announcements)
            : true
        )
        .map((widget: WidgetConfig) => (
          <div data-grid={widget} key={widget.i}>
            {getWidgetFromKey(widget)}
          </div>
        )),
    [layout, announcements, getWidgetFromKey, isEditView, isAnnouncementLoading]
  );

  const handleLayoutUpdate = useCallback(
    (updatedLayout: Layout[]) => {
      if (!isEmpty(layout) && !isEmpty(updatedLayout)) {
        setLayout(getLayoutUpdateHandler(updatedLayout));
      }
    },
    [layout]
  );

  const addedWidgetsList = useMemo(
    () =>
      layout
        .filter((widget) => widget.i.startsWith('KnowledgePanel'))
        .map((widget) => widget.i),
    [layout]
  );

  useEffect(() => {
    if (isEditView && !isUndefined(updateParentLayout)) {
      updateParentLayout(
        (parentLayoutData ?? []).map((widget) => {
          if (widget.i === LandingPageWidgetKeys.RIGHT_PANEL) {
            return {
              ...widget,
              data: {
                page: {
                  layout: uniqBy(
                    layout.filter(
                      (widget) => !widget.i.endsWith('.EmptyWidgetPlaceholder')
                    ),
                    'i'
                  ),
                },
              },
            };
          } else {
            return widget;
          }
        })
      );
    }
  }, [layout]);

  return (
    <>
      <ResponsiveGridLayout
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 1, md: 1, sm: 1, xs: 1, xxs: 1 }}
        containerPadding={[0, LANDING_PAGE_WIDGET_MARGIN]}
        draggableHandle=".drag-widget-icon"
        isResizable={false}
        margin={[LANDING_PAGE_WIDGET_MARGIN, LANDING_PAGE_WIDGET_MARGIN]}
        rowHeight={LANDING_PAGE_ROW_HEIGHT}
        onLayoutChange={handleLayoutUpdate}>
        {widgets}
      </ResponsiveGridLayout>
      {isWidgetModalOpen && (
        <AddWidgetModal
          addedWidgetsList={addedWidgetsList}
          handleAddWidget={handleAddWidget}
          handleCloseAddWidgetModal={handleCloseAddWidgetModal}
          maxGridSizeSupport={LANDING_PAGE_RIGHT_CONTAINER_MAX_GRID_SIZE}
          open={isWidgetModalOpen}
        />
      )}
    </>
  );
};

export default RightSidebar;
