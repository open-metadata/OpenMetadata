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

import i18next from 'i18next';
import {
  capitalize,
  isEmpty,
  isUndefined,
  max,
  uniqBy,
  uniqueId,
} from 'lodash';
import { Layout } from 'react-grid-layout';
import EmptyWidgetPlaceholder from '../components/MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder';
import { SIZE } from '../enums/common.enum';
import {
  LandingPageWidgetKeys,
  WidgetWidths,
} from '../enums/CustomizablePage.enum';
import { Document } from '../generated/entity/docStore/document';
import { Thread } from '../generated/entity/feed/thread';
import { EntityReference } from '../generated/entity/type';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import customizeMyDataPageClassBase from './CustomizeMyDataPageClassBase';

export const getNewWidgetPlacement = (
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

const getEmptyWidgetHeight = (
  widget: WidgetConfig,
  minHeight: number,
  maxHeight: number
) => {
  if (minHeight <= widget.h && widget.h <= maxHeight) {
    return widget.h;
  } else if (minHeight > widget.h) {
    return minHeight;
  } else {
    return maxHeight;
  }
};

export const moveEmptyWidgetToTheEnd = (layout: Array<WidgetConfig>) =>
  layout.map((widget) =>
    widget.i === LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
      ? { ...widget, y: 100 }
      : widget
  );

export const getRemoveWidgetHandler =
  (widgetKey: string, minHeight: number, maxHeight: number) =>
  (currentLayout: Array<WidgetConfig>) => {
    if (widgetKey.endsWith('.EmptyWidgetPlaceholder')) {
      return currentLayout.filter(
        (widget: WidgetConfig) => widget.i !== widgetKey
      );
    } else {
      return currentLayout.map((widget: WidgetConfig) =>
        widget.i === widgetKey
          ? {
              ...widget,
              i: widgetKey + '.EmptyWidgetPlaceholder',
              h: getEmptyWidgetHeight(widget, minHeight, maxHeight),
            }
          : widget
      );
    }
  };

export const getLayoutUpdateHandler =
  (updatedLayout: Layout[]) => (currentLayout: Array<WidgetConfig>) => {
    return updatedLayout.map((widget) => {
      const widgetData = currentLayout.find(
        (a: WidgetConfig) => a.i === widget.i
      );

      return {
        ...(!isEmpty(widgetData) ? widgetData : {}),
        ...widget,
      };
    });
  };

export const getWidgetWidth = (widget: Document) => {
  const gridSizes = widget.data.gridSizes;
  const widgetSize = max(
    gridSizes.map((size: WidgetWidths) => WidgetWidths[size])
  );

  return widgetSize as number;
};

export const getWidgetWidthLabelFromKey = (widgetKey: string) => {
  switch (widgetKey) {
    case 'large':
      return i18next.t('label.large');
    case 'medium':
      return i18next.t('label.medium');
    case 'small':
      return i18next.t('label.small');
    default:
      return capitalize(widgetKey);
  }
};

const getAllWidgetsArray = (layout: WidgetConfig[]) => {
  const widgetsArray: WidgetConfig[] = [];

  layout.forEach((widget) => {
    if (widget.i.startsWith('KnowledgePanel.')) {
      widgetsArray.push(widget);
    }
    const childLayout = widget.data?.page.layout;
    if (!isUndefined(childLayout)) {
      widgetsArray.push(...getAllWidgetsArray(childLayout));
    }
  });

  return widgetsArray;
};

export const getWidgetFromKey = ({
  widgetConfig,
  handleOpenAddWidgetModal,
  handlePlaceholderWidgetKey,
  handleRemoveWidget,
  announcements,
  followedDataCount,
  followedData,
  isLoadingOwnedData,
  iconHeight,
  iconWidth,
  isEditView,
  isAnnouncementLoading,
}: {
  widgetConfig: WidgetConfig;
  handleOpenAddWidgetModal?: () => void;
  handlePlaceholderWidgetKey?: (key: string) => void;
  handleRemoveWidget?: (key: string) => void;
  announcements?: Thread[];
  followedData?: EntityReference[];
  followedDataCount: number;
  isLoadingOwnedData: boolean;
  iconHeight?: SIZE;
  iconWidth?: SIZE;
  isEditView?: boolean;
  isAnnouncementLoading?: boolean;
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

  const Widget = customizeMyDataPageClassBase.getWidgetsFromKey(widgetConfig.i);

  return (
    <Widget
      announcements={announcements}
      followedData={followedData ?? []}
      followedDataCount={followedDataCount}
      handleRemoveWidget={handleRemoveWidget}
      isAnnouncementLoading={isAnnouncementLoading}
      isEditView={isEditView}
      isLoadingOwnedData={isLoadingOwnedData}
      selectedGridSize={widgetConfig.w}
      widgetKey={widgetConfig.i}
    />
  );
};

export const getLayoutWithEmptyWidgetPlaceholder = (
  layout: WidgetConfig[],
  emptyWidgetHeight = 2,
  emptyWidgetWidth = 1
) => [
  ...layout,
  {
    h: emptyWidgetHeight,
    i: LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER,
    w: emptyWidgetWidth,
    x: 0,
    y: 1000,
    isDraggable: false,
  },
];

// Function to filter out empty widget placeholders and only keep knowledge panels
export const getUniqueFilteredLayout = (layout: WidgetConfig[]) =>
  uniqBy(
    layout.filter(
      (widget) =>
        widget.i.startsWith('KnowledgePanel') &&
        !widget.i.endsWith('.EmptyWidgetPlaceholder')
    ),
    'i'
  );
