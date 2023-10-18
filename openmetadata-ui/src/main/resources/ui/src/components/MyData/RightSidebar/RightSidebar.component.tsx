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
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import RGL, { Layout, WidthProvider } from 'react-grid-layout';
import { SIZE } from '../../../enums/common.enum';
import { LandingPageWidgetKeys } from '../../../enums/CustomizablePage.enum';
import { Document } from '../../../generated/entity/docStore/document';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import {
  getAddWidgetHandler,
  getLayoutUpdateHandler,
  getRemoveWidgetHandler,
  getWidgetFromKey,
} from '../../../utils/CustomizableLandingPageUtils';
import customizePageClassBase from '../../../utils/CustomizePageClassBase';
import AddWidgetModal from '../../CustomizableComponents/AddWidgetModal/AddWidgetModal';
import './right-sidebar.less';
import { RightSidebarProps } from './RightSidebar.interface';

const ReactGridLayout = WidthProvider(RGL);

const RightSidebar = ({
  announcements,
  isAnnouncementLoading,
  isEditView = false,
  followedData,
  followedDataCount,
  isLoadingOwnedData,
  layout,
  handleLayoutChange,
  draggedItem,
}: RightSidebarProps) => {
  const [placeholderWidgetKey, setPlaceholderWidgetKey] = useState<string>(
    LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
  );
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState<boolean>(false);

  const handlePlaceholderWidgetKey = useCallback((value: string) => {
    setPlaceholderWidgetKey(value);
  }, []);

  const handleOpenAddWidgetModal = useCallback(() => {
    setIsWidgetModalOpen(true);
  }, []);

  const handleCloseAddWidgetModal = useCallback(() => {
    setIsWidgetModalOpen(false);
  }, []);

  const handleRemoveWidget = useCallback((widgetKey: string) => {
    !isUndefined(handleLayoutChange) &&
      handleLayoutChange(getRemoveWidgetHandler(widgetKey, 2.3, 2.5));
  }, []);

  const handleAddWidget = useCallback(
    (
      newWidgetData: Document,
      placeholderWidgetKey: string,
      widgetSize: number
    ) => {
      !isUndefined(handleLayoutChange) &&
        handleLayoutChange(
          getAddWidgetHandler(
            newWidgetData,
            placeholderWidgetKey,
            widgetSize,
            customizePageClassBase.landingPageRightContainerMaxGridSize
          )
        );
      setIsWidgetModalOpen(false);
    },
    [layout]
  );

  const widgets = useMemo(
    () =>
      layout
        .filter((widget: WidgetConfig) =>
          !isAnnouncementLoading &&
          widget.i.startsWith(LandingPageWidgetKeys.ANNOUNCEMENTS) &&
          !isEditView
            ? !isEmpty(announcements)
            : true
        )
        .map((widget: WidgetConfig) => (
          <div data-grid={widget} key={widget.i} unselectable="on">
            {getWidgetFromKey({
              announcements: announcements,
              followedData: followedData ?? [],
              followedDataCount: followedDataCount,
              isLoadingOwnedData: isLoadingOwnedData,
              widgetConfig: widget,
              handleOpenAddWidgetModal: handleOpenAddWidgetModal,
              handlePlaceholderWidgetKey: handlePlaceholderWidgetKey,
              handleRemoveWidget: handleRemoveWidget,
              iconHeight: SIZE.SMALL,
              iconWidth: SIZE.SMALL,
            })}
          </div>
        )),
    [
      layout,
      announcements,
      isEditView,
      isAnnouncementLoading,
      followedData,
      followedDataCount,
      isLoadingOwnedData,
      handleOpenAddWidgetModal,
      handlePlaceholderWidgetKey,
      handleRemoveWidget,
    ]
  );

  const handleLayoutUpdate = useCallback(
    (updatedLayout: Layout[]) => {
      if (!isEmpty(layout) && !isEmpty(updatedLayout) && handleLayoutChange) {
        handleLayoutChange(getLayoutUpdateHandler(updatedLayout));
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

  const handleWidgetDrop = (_: Layout[], item: Layout) => {
    if (
      draggedItem &&
      !layout.some((widget) => widget.i === draggedItem.i) &&
      handleLayoutChange
    ) {
      handleLayoutChange([
        ...layout,
        {
          ...item,
          i: draggedItem?.i,
          w: draggedItem?.w,
          h: draggedItem?.h,
        },
      ]);
    }
  };

  return (
    <>
      <ReactGridLayout
        isDroppable
        cols={1}
        containerPadding={[
          customizePageClassBase.landingPageWidgetMargin,
          customizePageClassBase.landingPageWidgetMargin,
        ]}
        draggableHandle=".drag-widget-icon"
        isResizable={false}
        margin={[
          customizePageClassBase.landingPageWidgetMargin,
          customizePageClassBase.landingPageWidgetMargin,
        ]}
        rowHeight={customizePageClassBase.landingPageRowHeight}
        onDrop={handleWidgetDrop}
        onLayoutChange={handleLayoutUpdate}>
        {widgets}
      </ReactGridLayout>
      {isWidgetModalOpen && (
        <AddWidgetModal
          addedWidgetsList={addedWidgetsList}
          handleAddWidget={handleAddWidget}
          handleCloseAddWidgetModal={handleCloseAddWidgetModal}
          maxGridSizeSupport={
            customizePageClassBase.landingPageRightContainerMaxGridSize
          }
          open={isWidgetModalOpen}
          placeholderWidgetKey={placeholderWidgetKey}
        />
      )}
    </>
  );
};

export default RightSidebar;
