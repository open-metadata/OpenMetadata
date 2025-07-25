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

import Icon from '@ant-design/icons';
import i18next from 'i18next';
import { capitalize, isUndefined, max, uniqBy, uniqueId } from 'lodash';
import { DOMAttributes } from 'react';
import { Layout } from 'react-grid-layout';
import { ReactComponent as ArrowRightIcon } from '../assets/svg/arrow-right.svg';
import EmptyWidgetPlaceholderV1 from '../components/MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholderV1';
import {
  LandingPageWidgetKeys,
  WidgetWidths,
} from '../enums/CustomizablePage.enum';
import { Document } from '../generated/entity/docStore/document';
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

/**
 * Creates a placeholder widget
 */
const createPlaceholderWidget = (x = 0, y = 0) => ({
  h: customizeMyDataPageClassBase.defaultWidgetHeight,
  i: LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER,
  w: 1,
  x,
  y,
  static: false,
  isDraggable: false,
});

/**
 * Separates regular widgets from placeholder widgets
 */
const separateWidgets = (layout: WidgetConfig[]) => {
  const regularWidgets = layout.filter(
    (widget) => !widget.i.endsWith('.EmptyWidgetPlaceholder')
  );
  const placeholderWidget = layout.find((widget) =>
    widget.i.endsWith('.EmptyWidgetPlaceholder')
  );

  return { regularWidgets, placeholderWidget };
};

/**
 * Ensures the placeholder widget is always at the end
 */
export const ensurePlaceholderAtEnd = (
  layout: WidgetConfig[]
): WidgetConfig[] => {
  if (!layout || layout.length === 0) {
    return [createPlaceholderWidget()];
  }

  const { regularWidgets } = separateWidgets(layout);

  if (regularWidgets.length === 0) {
    return [createPlaceholderWidget()];
  }

  // Find the widget with the maximum bottom edge (y + h)
  const last = regularWidgets.reduce((acc, curr) =>
    curr.y + curr.h > acc.y + acc.h ? curr : acc
  );

  // Try to place in the same row if space exists
  const nextX = last.x + last.w;
  const canFitInSameRow =
    nextX + 1 <= customizeMyDataPageClassBase.landingPageMaxGridSize;

  const placeholderWidget = createPlaceholderWidget(
    canFitInSameRow ? nextX : 0,
    canFitInSameRow ? last.y : last.y + last.h
  );

  return [...regularWidgets, placeholderWidget];
};

/**
 * Layout update handler
 */
export const getLayoutUpdateHandler =
  (updatedLayout: Layout[]) => (currentLayout: Array<WidgetConfig>) => {
    if (!updatedLayout || updatedLayout.length === 0) {
      return [createPlaceholderWidget()];
    }

    // Apply basic layout update from React Grid Layout
    const basicUpdatedLayout = updatedLayout.map((widget) => {
      const widgetData = currentLayout.find(
        (a: WidgetConfig) => a.i === widget.i
      );

      return {
        ...(!widgetData ? {} : widgetData),
        ...widget,
        static: false,
      };
    });

    return ensurePlaceholderAtEnd(basicUpdatedLayout);
  };

/**
 * Adds a new widget to the layout
 */
export const getAddWidgetHandler =
  (
    newWidgetData: Document,
    placeholderWidgetKey: string,
    widgetWidth: number,
    maxGridSize: number
  ) =>
  (currentLayout: Array<WidgetConfig>) => {
    if (!newWidgetData) {
      return [createPlaceholderWidget()];
    }

    const widgetFQN = uniqueId(
      `${newWidgetData.fullyQualifiedName || 'widget'}-`
    );
    const widgetHeight = customizeMyDataPageClassBase.getWidgetHeight(
      newWidgetData.name
    );

    if (!currentLayout || currentLayout.length === 0) {
      return [
        {
          w: widgetWidth,
          h: widgetHeight,
          i: widgetFQN,
          static: false,
          x: 0,
          y: 0,
        },
        createPlaceholderWidget(widgetWidth, 0),
      ];
    }

    const { regularWidgets } = separateWidgets(currentLayout);

    // If adding to placeholder, append and repack
    if (
      placeholderWidgetKey === LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
    ) {
      const newWidget = {
        w: widgetWidth,
        h: widgetHeight,
        i: widgetFQN,
        static: false,
        x: 0,
        y: 0,
      };

      return ensurePlaceholderAtEnd([...regularWidgets, newWidget]);
    }

    // Replace specific placeholder
    const updatedWidgets = currentLayout.map((widget: WidgetConfig) => {
      if (widget.i === placeholderWidgetKey) {
        return {
          ...widget,
          i: widgetFQN,
          h: widgetHeight,
          w: widgetWidth,
          x: Math.min(widget.x, maxGridSize - widgetWidth),
          static: false,
        };
      }

      return widget;
    });

    return ensurePlaceholderAtEnd(updatedWidgets);
  };

/**
 * Removes a widget and repacks the layout
 */
export const getRemoveWidgetHandler =
  (widgetKey: string) => (currentLayout: Array<WidgetConfig>) => {
    if (!currentLayout || currentLayout.length === 0) {
      return [createPlaceholderWidget()];
    }

    const filteredLayout = currentLayout.filter(
      (widget: WidgetConfig) => widget.i !== widgetKey
    );

    return ensurePlaceholderAtEnd(filteredLayout);
  };

/**
 * Gets widget width from document configuration
 */
export const getWidgetWidth = (widget: Document): number => {
  if (!widget?.data?.gridSizes || !Array.isArray(widget.data.gridSizes)) {
    return 1;
  }

  const widgetSize = max(
    widget.data.gridSizes.map((size: string) =>
      size in WidgetWidths ? WidgetWidths[size as keyof typeof WidgetWidths] : 1
    )
  );

  return widgetSize as number;
};

/**
 * Gets human-readable widget width label
 */
export const getWidgetWidthLabelFromKey = (widgetKey: string): string => {
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

/**
 * Renders widget component based on configuration
 */
export const getWidgetFromKey = ({
  currentLayout,
  handleLayoutUpdate,
  handleOpenAddWidgetModal,
  handlePlaceholderWidgetKey,
  handleRemoveWidget,
  isEditView,
  personaName,
  widgetConfig,
}: {
  currentLayout?: Array<WidgetConfig>;
  handleLayoutUpdate?: (layout: Layout[]) => void;
  handleOpenAddWidgetModal?: () => void;
  handlePlaceholderWidgetKey?: (key: string) => void;
  handleRemoveWidget?: (key: string) => void;
  isEditView?: boolean;
  personaName?: string;
  widgetConfig: WidgetConfig;
}) => {
  if (
    widgetConfig.i.endsWith('.EmptyWidgetPlaceholder') &&
    !isUndefined(handleOpenAddWidgetModal) &&
    !isUndefined(handlePlaceholderWidgetKey)
  ) {
    return (
      <EmptyWidgetPlaceholderV1
        handleOpenAddWidgetModal={handleOpenAddWidgetModal}
        handlePlaceholderWidgetKey={handlePlaceholderWidgetKey}
        personaName={personaName}
        widgetKey={widgetConfig.i}
      />
    );
  }

  const Widget = customizeMyDataPageClassBase.getWidgetsFromKey(widgetConfig.i);

  return (
    <Widget
      currentLayout={currentLayout}
      handleLayoutUpdate={handleLayoutUpdate}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      selectedGridSize={widgetConfig.w}
      widgetKey={widgetConfig.i}
    />
  );
};

/**
 * Custom arrow components for carousel navigation
 */
export const CustomNextArrow = (props: DOMAttributes<HTMLDivElement>) => (
  <Icon
    className="custom-arrow right-arrow"
    component={ArrowRightIcon}
    onClick={props.onClick}
  />
);

export const CustomPrevArrow = (props: DOMAttributes<HTMLDivElement>) => (
  <Icon
    className="custom-arrow left-arrow"
    component={ArrowRightIcon}
    onClick={props.onClick}
  />
);

/**
 * Creates a layout with empty widget placeholder at the end
 */
export const getLayoutWithEmptyWidgetPlaceholder = (
  layout: WidgetConfig[],
  emptyWidgetHeight = 4,
  emptyWidgetWidth = 1
) => {
  // Handle empty or null layout
  if (!layout || layout.length === 0) {
    return [
      {
        h: emptyWidgetHeight,
        i: LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER,
        w: emptyWidgetWidth,
        x: 0,
        y: 0,
        isDraggable: false,
      },
    ];
  }

  return ensurePlaceholderAtEnd(layout);
};

/**
 * Creates a landing page layout with empty widget placeholder
 */
export const getLandingPageLayoutWithEmptyWidgetPlaceholder = (
  layout: WidgetConfig[],
  emptyWidgetHeight = 3,
  emptyWidgetWidth = 1
) => {
  if (!layout || layout.length === 0) {
    return [
      {
        h: emptyWidgetHeight,
        i: LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER,
        w: emptyWidgetWidth,
        x: 0,
        y: 0,
        isDraggable: false,
      },
    ];
  }

  return ensurePlaceholderAtEnd(layout);
};

/**
 * Filters out empty widget placeholders and only keeps knowledge panels
 */
export const getUniqueFilteredLayout = (layout: WidgetConfig[]) => {
  // Handle empty or null layout
  if (!layout || layout.length === 0) {
    return [];
  }

  return uniqBy(
    layout.filter(
      (widget) =>
        widget.i.startsWith('KnowledgePanel') &&
        !widget.i.endsWith('.EmptyWidgetPlaceholder')
    ),
    'i'
  );
};
