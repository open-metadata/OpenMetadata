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

import {
  floor,
  isEmpty,
  isUndefined,
  max,
  maxBy,
  round,
  uniqueId,
} from 'lodash';
import { Layout } from 'react-grid-layout';
import {
  DEFAULT_WIDGET_HEIGHT,
  LANDING_PAGE_RIGHT_CONTAINER_EDIT_HEIGHT,
  LANDING_PAGE_ROW_HEIGHT,
  LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS,
  LANDING_PAGE_WIDGET_MARGIN,
} from '../constants/CustomisePage.constants';
import {
  LandingPageWidgetKeys,
  WidgetWidths,
} from '../enums/CustomizablePage.enum';
import { Document } from '../generated/entity/docStore/document';
import { WidgetConfig } from '../pages/CustomisablePages/CustomisablePage.interface';

export const getAddWidgetHandler =
  (newWidgetData: Document, placeholderWidgetKey: string) =>
  (currentLayout: Array<WidgetConfig>) => {
    const widgetFQN = uniqueId(`${newWidgetData.fullyQualifiedName}-`);
    const widgetWidth = getWidgetWidth(newWidgetData);
    const widgetHeight = getWidgetHeight(newWidgetData.name);

    // The widget with key "ExtraWidget.EmptyWidgetPlaceholder" will always remain in the bottom
    // and is not meant to be replaced hence
    // if placeholderWidgetKey is "ExtraWidget.EmptyWidgetPlaceholder"
    // append the new widget in the array
    // else replace the new widget with other placeholder widgets
    if (
      placeholderWidgetKey === LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
    ) {
      return [
        ...currentLayout,
        {
          w: widgetWidth,
          h: widgetHeight,
          x: 0,
          y: 0,
          i: widgetFQN,
          static: false,
        },
      ];
    } else {
      return currentLayout.map((widget: WidgetConfig) =>
        widget.i === placeholderWidgetKey
          ? {
              ...widget,
              i: widgetFQN,
              h: widgetHeight,
              w: widgetWidth,
            }
          : widget
      );
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

export const getWidgetHeight = (widgetName: string) => {
  switch (widgetName) {
    case 'ActivityFeed':
      return LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.activityFeed;
    case 'RightSidebar':
      return LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.rightSidebar;
    case 'Announcements':
      return LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.announcements;
    case 'Following':
      return LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.following;
    case 'RecentlyViewed':
      return LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.recentlyViewed;
    case 'MyData':
      return LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.myData;
    case 'KPI':
      return LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.kpi;
    case 'TotalDataAssets':
      return LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.totalDataAssets;
    default:
      return DEFAULT_WIDGET_HEIGHT;
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

const getLayoutWithCalculatedRightPanelHeight = (
  layout: WidgetConfig[],
  increaseHeight?: boolean
) => {
  const allWidgets = getAllWidgetsArray(layout);
  const maxHeightsArray = allWidgets.map((widget) => {
    const widgetHeightAndPos = widget.h + widget.y;
    const floorHeightAndPosValue = floor(widgetHeightAndPos);

    const heightOfWidget =
      widgetHeightAndPos * LANDING_PAGE_ROW_HEIGHT +
      (floorHeightAndPosValue + 1) * LANDING_PAGE_WIDGET_MARGIN;

    return {
      h: round(
        (heightOfWidget + LANDING_PAGE_WIDGET_MARGIN) /
          (LANDING_PAGE_ROW_HEIGHT + LANDING_PAGE_WIDGET_MARGIN),
        2
      ),
      height: heightOfWidget,
    };
  });

  const maxHeight = maxBy(maxHeightsArray, 'height');

  return layout.map((widget) =>
    widget.i === LandingPageWidgetKeys.RIGHT_PANEL
      ? {
          ...widget,
          h: increaseHeight
            ? LANDING_PAGE_RIGHT_CONTAINER_EDIT_HEIGHT
            : maxHeight?.h ?? widget.h,
        }
      : widget
  );
};

export const getFinalLandingPage = (
  page: Document,
  increaseHeight?: boolean
): Document => {
  return {
    ...page,
    data: {
      page: {
        layout: getLayoutWithCalculatedRightPanelHeight(
          page.data.page?.layout ?? [],
          increaseHeight
        ),
      },
    },
  };
};
