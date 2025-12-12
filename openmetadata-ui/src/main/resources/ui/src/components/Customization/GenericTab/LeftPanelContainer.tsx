/* eslint-disable no-console */
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
import { Col, Row } from 'antd';
import { isUndefined } from 'lodash';
import { useMemo } from 'react';
import RGL, { ReactGridLayoutProps, WidthProvider } from 'react-grid-layout';
import { PageType } from '../../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getWidgetsFromKey } from '../../../utils/CustomizePage/CustomizePageUtils';
import EmptyWidgetPlaceholder from '../../MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder';
import { GenericWidget } from '../GenericWidget/GenericWidget';
import './generic-tab.less';

const ReactGridLayout = WidthProvider(RGL) as React.ComponentType<
  ReactGridLayoutProps & { children?: React.ReactNode }
>;

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
            selectedGridSize={widget.w}
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
        <Col id={widget.i} key={widget.i} span={Math.round(widget.w * 24)}>
          {getWidgetsFromKey(type, widget)}
        </Col>
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
        containerPadding={[0, 16]}
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

  return <Row gutter={[16, 16]}>{widgets}</Row>;
};
