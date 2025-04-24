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
import classNames from 'classnames';
import { useMemo } from 'react';
import {
  default as RGL,
  ReactGridLayoutProps,
  WidthProvider,
} from 'react-grid-layout';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { PageType } from '../../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getWidgetsFromKey } from '../../../utils/CustomizePage/CustomizePageUtils';
import { useGenericContext } from '../GenericProvider/GenericProvider';
import './generic-tab.less';

const ReactGridLayout = WidthProvider(RGL) as React.ComponentType<
  ReactGridLayoutProps & { children?: React.ReactNode }
>;

interface GenericTabProps {
  type: PageType;
}

export const GenericTab = ({ type }: GenericTabProps) => {
  const { layout } = useGenericContext();

  const widgets = useMemo(() => {
    return layout?.map((widget: WidgetConfig) => {
      return (
        <div
          className="overflow-auto-y"
          data-grid={widget}
          id={widget.i}
          key={widget.i}>
          {getWidgetsFromKey(type, widget)}
        </div>
      );
    });
  }, [layout, type]);

  // For default tabs we have rigid layout where we are not applying any bg to container
  // So we need to check if left panel is present to apply bg to container
  const leftSideWidgetPresent = useMemo(() => {
    return layout?.some((widget) =>
      widget.i.startsWith(DetailPageWidgetKeys.LEFT_PANEL)
    );
  }, [layout]);

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  return (
    <ReactGridLayout
      autoSize
      className={classNames('grid-container bg-grey', {
        'custom-tab': !leftSideWidgetPresent,
      })}
      cols={8}
      containerPadding={[0, 0]}
      isDraggable={false}
      isResizable={false}
      margin={[16, 16]}
      rowHeight={100}>
      {widgets}
    </ReactGridLayout>
  );
};
