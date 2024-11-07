/*
 *  Copyright 2024 Collate.
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
import { TabsProps } from 'antd';
import { isUndefined, uniqueId } from 'lodash';
import React from 'react';
import EmptyWidgetPlaceholder from '../../components/MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder';
import { SIZE } from '../../enums/common.enum';
import { LandingPageWidgetKeys } from '../../enums/CustomizablePage.enum';
import { GlossaryTermDetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { Document } from '../../generated/entity/docStore/document';
import { Tab } from '../../generated/system/ui/uiCustomization';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import customizeGlossaryTermPageClassBase from '../CustomiseGlossaryTermPage/CustomizeGlossaryTermPage';
import { moveEmptyWidgetToTheEnd } from '../CustomizableLandingPageUtils';
import customizeMyDataPageClassBase from '../CustomizeMyDataPageClassBase';
import { getEntityName } from '../EntityUtils';

export const getWidgetFromKey = ({
  widgetConfig,
  handleOpenAddWidgetModal,
  handlePlaceholderWidgetKey,
  handleRemoveWidget,
  isEditView,
  iconHeight,
  iconWidth,
}: {
  widgetConfig: WidgetConfig;
  handleOpenAddWidgetModal?: () => void;
  handlePlaceholderWidgetKey?: (key: string) => void;
  handleRemoveWidget?: (key: string) => void;
  iconHeight?: SIZE;
  iconWidth?: SIZE;
  isEditView?: boolean;
}) => {
  if (
    widgetConfig.i.endsWith('.EmptyWidgetPlaceholder') &&
    !isUndefined(handleOpenAddWidgetModal) &&
    !isUndefined(handlePlaceholderWidgetKey) &&
    !isUndefined(handleRemoveWidget)
  ) {
    return (
      <EmptyWidgetPlaceholder
        handleOpenAddWidgetModal={handleOpenAddWidgetModal}
        handlePlaceholderWidgetKey={handlePlaceholderWidgetKey}
        handleRemoveWidget={handleRemoveWidget}
        iconHeight={iconHeight}
        iconWidth={iconWidth}
        isEditable={widgetConfig.isDraggable}
        widgetKey={widgetConfig.i}
      />
    );
  }

  const widgetKey = customizeGlossaryTermPageClassBase.getKeyFromWidgetName(
    widgetConfig.i
  );

  const Widget = customizeGlossaryTermPageClassBase.getWidgetsFromKey<
    typeof widgetKey
  >(widgetConfig.i as GlossaryTermDetailPageWidgetKeys);

  return (
    <Widget
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      selectedGridSize={widgetConfig.w}
      widgetKey={widgetConfig.i}
    />
  );
};

const getNewWidgetPlacement = (
  currentLayout: WidgetConfig[],
  widgetWidth: number
) => {
  const lowestWidgetLayout = currentLayout.reduce(
    (acc, widget) => {
      if (
        widget.y >= acc.y &&
        widget.i !== LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
      ) {
        if (widget.y === acc.y && widget.x < acc.x) {
          return acc;
        }

        return widget;
      }

      return acc;
    },
    { y: 0, x: 0, w: 0 }
  );

  // Check if there's enough space to place the new widget on the same row
  if (
    customizeMyDataPageClassBase.landingPageMaxGridSize -
      (lowestWidgetLayout.x + lowestWidgetLayout.w) >=
    widgetWidth
  ) {
    return {
      x: lowestWidgetLayout.x + lowestWidgetLayout.w,
      y: lowestWidgetLayout.y,
    };
  }

  // Otherwise, move to the next row
  return {
    x: 0,
    y: lowestWidgetLayout.y + 1,
  };
};

export const getAddWidgetHandler =
  (
    newWidgetData: Document,
    placeholderWidgetKey: string,
    widgetWidth: number,
    maxGridSize: number
  ) =>
  (currentLayout: Array<WidgetConfig>) => {
    const widgetFQN = uniqueId(`${newWidgetData.fullyQualifiedName}-`);
    const widgetHeight = customizeMyDataPageClassBase.getWidgetHeight(
      newWidgetData.name
    );

    // The widget with key "ExtraWidget.EmptyWidgetPlaceholder" will always remain in the bottom
    // and is not meant to be replaced hence
    // if placeholderWidgetKey is "ExtraWidget.EmptyWidgetPlaceholder"
    // append the new widget in the array
    // else replace the new widget with other placeholder widgets
    if (
      placeholderWidgetKey === LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
    ) {
      return [
        ...moveEmptyWidgetToTheEnd(currentLayout),
        {
          w: widgetWidth,
          h: widgetHeight,
          i: widgetFQN,
          static: false,
          ...getNewWidgetPlacement(currentLayout, widgetWidth),
        },
      ];
    } else {
      return currentLayout.map((widget: WidgetConfig) => {
        const widgetX =
          widget.x + widgetWidth <= maxGridSize
            ? widget.x
            : maxGridSize - widgetWidth;

        return widget.i === placeholderWidgetKey
          ? {
              ...widget,
              i: widgetFQN,
              h: widgetHeight,
              w: widgetWidth,
              x: widgetX,
            }
          : widget;
      });
    }
  };

export const getGlossaryTermDetailTabs = (
  defaultTabs: TabsProps['items'],
  customizedTabs?: Tab[],
  defaultTabId: EntityTabs = EntityTabs.OVERVIEW
) => {
  if (!customizedTabs) {
    return defaultTabs;
  }
  const overviewTab = defaultTabs?.find((t) => t.key === defaultTabId);

  const newTabs =
    customizedTabs?.map((t) => {
      const tabItemDetails = defaultTabs?.find((i) => i.key === t.id);

      return (
        tabItemDetails ?? {
          label: getEntityName(t),
          key: t.id,
          children: overviewTab?.children,
        }
      );
    }) ?? defaultTabs;

  return newTabs;
};

export const getTabLabelMap = (tabs?: Tab[]): Record<EntityTabs, string> => {
  const labelMap = {} as Record<EntityTabs, string>;

  return (
    tabs?.reduce((acc: Record<EntityTabs, string>, item) => {
      if (item.id && item.displayName) {
        const tab = item.id as EntityTabs;
        acc[tab] = item.displayName;
      }

      return acc;
    }, labelMap) ?? labelMap
  );
};
