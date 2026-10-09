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
import { Grid } from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../../utils/common/layout.utils';

import { isUndefined, orderBy } from 'lodash';
import { lazy, useMemo } from 'react';
import type {
  ItemCallback,
  Layout,
  ReactGridLayoutProps,
} from 'react-grid-layout';
import RGL, { WidthProvider } from 'react-grid-layout';
import { PageType } from '../../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import type { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getWidgetsFromKey } from '../../../utils/CustomizePage/CustomizePageDispatchUtils';
import {
  fromLeftPanelEditGrid,
  getLeftPanelFlowLayout,
  toLeftPanelEditGrid,
} from '../../../utils/CustomizePage/GridLayoutDragUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import './generic-tab.less';

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
  // Columns of the edit grid: the ones the panel spans in the tab grid.
  editColumns?: number;
  onDrag?: ItemCallback;
  onDragStop?: ItemCallback;
}

export const LeftPanelContainer = ({
  layout,
  type,
  onUpdate,
  isEditView = false,
  handleOpenAddWidgetModal,
  handlePlaceholderWidgetKey,
  editColumns = 1,
  onDrag,
  onDragStop,
}: GenericTabProps) => {
  const handleRemoveWidget = (widgetKey: string) => {
    onUpdate(layout.filter((widget) => widget.i !== widgetKey));
  };

  // The edit grid is controlled and always shows the flow layout view mode
  // draws, so a widget moved or resized into a gap snaps to where it will show.
  const editLayout = useMemo(
    () =>
      getLeftPanelFlowLayout(layout).map((widget) =>
        toLeftPanelEditGrid(widget, editColumns)
      ),
    [layout, editColumns]
  );

  const handleLayoutChange = (gridLayout: Layout[]) => {
    onUpdate(
      getLeftPanelFlowLayout(
        gridLayout.map((widget) => fromLeftPanelEditGrid(widget, editColumns))
      )
    );
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
        <div id={widget.i} key={widget.i}>
          {widgetComponent}
        </div>
      );
    });
  };

  const widgets = useMemo(() => {
    if (isEditView) {
      return getWidgetFromLayout(layout);
    }

    // The edit grid saves its widgets in list order, which need not match where
    // they sit, so view mode lays them out by row and then column.
    return orderBy(layout, ['y', 'x']).map((widget: WidgetConfig) => {
      return (
        <Grid.Item
          className="layout-column"
          id={widget.i}
          key={widget.i}
          span={Math.round(widget.w * 24)}>
          {getWidgetsFromKey(type, widget)}
        </Grid.Item>
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
        cols={editColumns}
        containerPadding={[16, 16]}
        isDraggable={isEditView}
        isResizable={isEditView}
        layout={editLayout}
        margin={[type === PageType.GlossaryTerm ? 16 : 0, 16]}
        preventCollision={false}
        rowHeight={100}
        onDrag={onDrag}
        onDragStop={onDragStop}
        onLayoutChange={handleLayoutChange}>
        {widgets}
      </ReactGridLayout>
    );
  }

  return (
    <Grid
      className="layout-row layout-grid left-panel-content"
      style={getLayoutGutter(16, 16)}>
      {widgets}
    </Grid>
  );
};
