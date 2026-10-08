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
import { Box } from '@openmetadata/ui-core-components';
import { isUndefined } from 'lodash';
import { lazy, useMemo } from 'react';
import type { ReactGridLayoutProps } from 'react-grid-layout';
import RGL, { WidthProvider } from 'react-grid-layout';
import { PageType } from '../../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import type { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getWidgetsFromKey } from '../../../utils/CustomizePage/CustomizePageDispatchUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import './generic-tab.less';

// Same box as the antd 24-column `Col span` this replaced; widget.w is a 0..1 fraction.
const getColumnStyle = (w: number) => {
  const width = `${(Math.round(w * 24) / 24) * 100}%`;

  return { flex: `0 0 ${width}`, maxWidth: width };
};

const ReactGridLayout = WidthProvider(RGL) as React.ComponentType<
  ReactGridLayoutProps & { children?: React.ReactNode }
>;

const GenericWidget = withSuspenseFallback(
  lazy(() =>
    import('../GenericWidget/GenericWidget').then((module) => ({
      default: module.GenericWidget,
    }))
  )
);

const EmptyWidgetPlaceholder = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder'
      )
  )
);

interface GenericTabProps {
  layout: WidgetConfig[];
  type: PageType;
  onUpdate: (layout: WidgetConfig[]) => void;
  isEditView: boolean;
  handleOpenAddWidgetModal?: () => void;
  handlePlaceholderWidgetKey?: (value: string) => void;
}

export const LeftPanelContainer = ({
  layout,
  type,
  onUpdate,
  isEditView = false,
  handleOpenAddWidgetModal,
  handlePlaceholderWidgetKey,
}: GenericTabProps) => {
  const handleRemoveWidget = (widgetKey: string) => {
    onUpdate(layout.filter((widget) => widget.i !== widgetKey));
  };

  const handleWidgetConfigChange = (
    widgetKey: string,
    config: WidgetConfig['config']
  ) => {
    onUpdate(
      layout.map((widget) =>
        widget.i === widgetKey ? { ...widget, config } : widget
      )
    );
  };

  const getWidgetFromLayout = (layout: WidgetConfig[]) => {
    return layout.map((widget) => {
      let widgetComponent = null;

      if (
        widget.i.endsWith('.EmptyWidgetPlaceholder') &&
        !isUndefined(handleOpenAddWidgetModal) &&
        !isUndefined(handlePlaceholderWidgetKey) &&
        !isUndefined(handleRemoveWidget)
      ) {
        widgetComponent = (
          <EmptyWidgetPlaceholder
            handleOpenAddWidgetModal={handleOpenAddWidgetModal}
            handlePlaceholderWidgetKey={handlePlaceholderWidgetKey}
            handleRemoveWidget={handleRemoveWidget}
            isEditable={widget.isDraggable}
            widgetKey={widget.i}
          />
        );
      } else {
        widgetComponent = (
          <GenericWidget
            isEditView
            handleRemoveWidget={handleRemoveWidget}
            handleWidgetConfigChange={handleWidgetConfigChange}
            selectedGridSize={widget.w}
            widgetConfig={widget}
            widgetKey={widget.i}
          />
        );
      }

      return (
        <div data-grid={widget} id={widget.i} key={widget.i}>
          {widgetComponent}
        </div>
      );
    });
  };

  const widgets = useMemo(() => {
    if (isEditView) {
      return getWidgetFromLayout(layout);
    }

    return layout?.map((widget: WidgetConfig) => {
      return (
        <div
          className="tw:px-2"
          id={widget.i}
          key={widget.i}
          style={getColumnStyle(widget.w)}>
          {getWidgetsFromKey(type, widget)}
        </div>
      );
    });
  }, [layout, type, isEditView]);

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  if (isEditView) {
    return (
      <ReactGridLayout
        autoSize
        useCSSTransforms
        verticalCompact
        className="grid-container"
        cols={1}
        containerPadding={[16, 16]}
        isDraggable={isEditView}
        isResizable={isEditView}
        margin={[type === PageType.GlossaryTerm ? 16 : 0, 16]}
        preventCollision={false}
        rowHeight={100}
        onLayoutChange={onUpdate}>
        {widgets}
      </ReactGridLayout>
    );
  }

  return (
    <Box className="left-panel-content tw:-mx-2" rowGap={4} wrap="wrap">
      {widgets}
    </Box>
  );
};
