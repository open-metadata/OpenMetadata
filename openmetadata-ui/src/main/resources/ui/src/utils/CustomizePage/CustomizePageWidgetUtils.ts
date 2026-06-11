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

import { get, noop, uniqueId } from 'lodash';
import type { CommonWidgetType } from '../../constants/CustomizeWidgets.constants';
import { LandingPageWidgetKeys } from '../../enums/CustomizablePage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import type { Page, Tab } from '../../generated/system/ui/page';
import { PageType } from '../../generated/system/ui/page';
import type { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import { getNewWidgetPlacement } from '../CustomizableLandingPagePureUtils';;
import {
  getDefaultWidgetForTab,
  getWidgetHeight,
} from './CustomizePageDispatchUtils';

const calculateNewPosition = (
  currentLayout: WidgetConfig[],
  newWidget: { w: number; h: number },
  maxCols = 8
) => {
  const sortedLayout = [...currentLayout].sort(
    (a, b) => a.y + a.h - (b.y + b.h)
  );

  const lastWidget = sortedLayout.at(sortedLayout.length - 1);

  if (!lastWidget) {
    return { x: 0, y: 0 };
  }

  const lastRowY = lastWidget.y + lastWidget.h;
  const lastRowWidgets = sortedLayout.filter(
    (widget) => widget.y + widget.h === lastRowY
  );

  const lastX = lastRowWidgets.reduce(
    (maxX, widget) => Math.max(maxX, widget.x + widget.w),
    0
  );

  if (lastX + newWidget.w <= maxCols) {
    return { x: lastX, y: lastRowY - lastWidget.h };
  }

  return { x: 0, y: lastRowY };
};

export const getAddWidgetHandler =
  (
    newWidgetData: CommonWidgetType,
    placeholderWidgetKey: string,
    widgetWidth: number,
    pageType: PageType
  ) =>
  (currentLayout: Array<WidgetConfig>): WidgetConfig[] => {
    const widgetFQN = uniqueId(`${newWidgetData.fullyQualifiedName}-`);
    const widgetHeight = getWidgetHeight(
      pageType,
      newWidgetData.fullyQualifiedName
    );

    if (
      placeholderWidgetKey === LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
    ) {
      const newPlacement = getNewWidgetPlacement(currentLayout, widgetWidth);

      return [
        ...currentLayout.map((widget) =>
          widget.i === placeholderWidgetKey
            ? { ...widget, y: newPlacement.y + 1 }
            : widget
        ),
        {
          i: widgetFQN,
          h: widgetHeight,
          w: widgetWidth,
          static: false,
          ...newPlacement,
        },
      ];
    } else {
      const { x: widgetX, y: widgetY } = calculateNewPosition(
        currentLayout.filter(
          (widget) =>
            widget.i !== LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
        ),
        {
          w: widgetWidth,
          h: widgetHeight,
        }
      );

      return [
        ...currentLayout,
        {
          i: widgetFQN,
          h: widgetHeight,
          w: widgetWidth,
          x: widgetX,
          y: widgetY,
        },
      ];
    }
  };

export const asyncNoop = async () => {
  noop();
};

export const getLayoutFromCustomizedPage = (
  pageType: PageType,
  tab: EntityTabs,
  customizedPage?: Page | null,
  isVersionView = false
) => {
  if (!customizedPage || isVersionView) {
    return getDefaultWidgetForTab(pageType, tab);
  }

  if (customizedPage?.tabs?.length) {
    return tab
      ? customizedPage.tabs?.find((t: Tab) => t.id === tab)?.layout
      : get(customizedPage, 'tabs.0.layout', []);
  } else {
    return getDefaultWidgetForTab(pageType, tab);
  }
};

export const updateWidgetHeightRecursively = (
  widgetId: string,
  height: number,
  widgets: WidgetConfig[]
) =>
  widgets.reduce((acc, widget) => {
    if (widget.i === widgetId) {
      acc.push({ ...widget, h: height });
    } else if (widget.children) {
      acc.push({
        ...widget,
        children: widget.children.map((child) =>
          child.i === widgetId ? { ...child, h: height } : child
        ),
      });
    } else {
      acc.push(widget);
    }

    return acc;
  }, [] as WidgetConfig[]);
