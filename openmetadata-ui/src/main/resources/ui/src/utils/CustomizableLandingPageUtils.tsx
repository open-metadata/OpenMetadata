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
import { capitalize, isUndefined, uniqBy, uniqueId } from 'lodash';
import { DOMAttributes } from 'react';
import { Layout } from 'react-grid-layout';
import { ReactComponent as ArrowRightIcon } from '../assets/svg/arrow-right.svg';
import EmptyWidgetPlaceholderV1 from '../components/MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholderV1';
import { LandingPageWidgetKeys } from '../enums/CustomizablePage.enum';
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
 * Creates a placeholder widget with collision prevention
 */
const createPlaceholderWidget = (x = 0, y = 0) => ({
  h: customizeMyDataPageClassBase.defaultWidgetHeight,
  i: LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER,
  w: 1,
  x,
  y,
  static: true, // Prevent collision - nothing can overlap this widget
  isDraggable: false,
});

/**
 * Separates regular widgets from placeholder widgets
 */
export const separateWidgets = (layout: WidgetConfig[]) => {
  const regularWidgets = layout.filter(
    (widget) => !widget.i.endsWith('.EmptyWidgetPlaceholder')
  );
  const placeholderWidget = layout.find((widget) =>
    widget.i.endsWith('.EmptyWidgetPlaceholder')
  );

  return { regularWidgets, placeholderWidget };
};

/**
 * Packs widgets tightly without gaps
 * - Widgets are arranged left to right, top to bottom
 * - No empty spaces between widgets
 * - Ensures tight coupling
 * - Excludes placeholder widgets from packing
 */
const packWidgetsTightly = (widgets: WidgetConfig[]): WidgetConfig[] => {
  if (widgets.length === 0) {
    return [];
  }

  // Filter out placeholder widgets and sort by current position
  const { regularWidgets, placeholderWidget } = separateWidgets(widgets);

  // Sort widgets by position to ensure proper tight packing
  const sortedWidgets = regularWidgets.sort((a, b) => {
    if (a.y !== b.y) {
      return a.y - b.y;
    }

    return a.x - b.x;
  });

  const packedWidgets: WidgetConfig[] = [];
  let currentX = 0;
  let currentY = 0;
  let maxHeightInRow = 0;

  sortedWidgets.forEach((widget) => {
    if (
      widget.i !== LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER &&
      widget.y === placeholderWidget?.y &&
      widget.x >= placeholderWidget?.x
    ) {
      // Keep the widget's original position if it's at or after placeholder position
      packedWidgets.push({
        ...widget,
        static: false,
      });

      return;
    }

    // Check if widget fits in current row
    if (
      currentX + widget.w >
      customizeMyDataPageClassBase.landingPageMaxGridSize
    ) {
      // Move to next row
      currentX = 0;
      currentY += maxHeightInRow;
      maxHeightInRow = 0;
    }

    // Position the widget
    const positionedWidget = {
      ...widget,
      x: currentX,
      y: currentY,
      static: false,
    };

    packedWidgets.push(positionedWidget);

    // Update position for next widget
    currentX += widget.w;
    maxHeightInRow = Math.max(maxHeightInRow, widget.h);
  });

  return packedWidgets;
};

/**
 * Ensures the placeholder widget is always at the end with tight coupling
 * - Widgets are packed tightly without gaps
 * - Placeholder is positioned after the last widget
 * - No widgets can be placed after the placeholder
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

  // Pack widgets tightly first
  const packedWidgets = packWidgetsTightly(regularWidgets);

  // Find the rightmost and bottommost position after packing
  let maxX = 0;
  let maxY = 0;

  packedWidgets.forEach((widget) => {
    const widgetEndX = widget.x + widget.w;
    const widgetEndY = widget.y + widget.h;
    maxX = Math.max(maxX, widgetEndX);
    maxY = Math.max(maxY, widgetEndY);
  });

  // Find available space in the last row
  const widgetsInLastRow = packedWidgets.filter(
    (widget) =>
      widget.y === maxY - customizeMyDataPageClassBase.defaultWidgetHeight
  );

  // Calculate the rightmost position in the last row
  let rightmostInLastRow = 0;
  widgetsInLastRow.forEach((widget) => {
    const widgetEndX = widget.x + widget.w;
    rightmostInLastRow = Math.max(rightmostInLastRow, widgetEndX);
  });

  // Check if there's space in the last row
  const canFitInLastRow =
    rightmostInLastRow + 1 <=
    customizeMyDataPageClassBase.landingPageMaxGridSize;

  const placeholderWidget = createPlaceholderWidget(
    canFitInLastRow ? rightmostInLastRow : 0,
    canFitInLastRow
      ? maxY - customizeMyDataPageClassBase.defaultWidgetHeight
      : maxY
  );

  return [...packedWidgets, placeholderWidget];
};

/**
 * Layout update handler with tight coupling
 * - Ensures widgets are packed tightly after drag operations
 * - Placeholder is always positioned correctly
 * - No gaps between widgets
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

    // Separate regular widgets and pack them tightly
    const { regularWidgets } = separateWidgets(basicUpdatedLayout);

    if (regularWidgets.length === 0) {
      return [createPlaceholderWidget()];
    }

    // Pack widgets tightly and ensure placeholder at end
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
      // Calculate position at the end of all existing widgets
      const placement = getNewWidgetPlacement(regularWidgets, widgetWidth);

      const newWidget = {
        w: widgetWidth,
        h: widgetHeight,
        i: widgetFQN,
        static: false,
        x: placement.x,
        y: placement.y,
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
