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
import React, { useMemo } from 'react';
import RGL, { WidthProvider } from 'react-grid-layout';
import { useParams } from 'react-router-dom';
import { EntityTabs } from '../../../enums/entity.enum';
import { Page, PageType, Tab } from '../../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { useCustomizeStore } from '../../../pages/CustomizablePage/CustomizeStore';
import {
  getDefaultWidgetForTab,
  getWidgetsFromKey,
} from '../../../utils/CustomizePage/CustomizePageUtils';

const ReactGridLayout = WidthProvider(RGL);

interface GenericTabProps {
  type: PageType;
}

export const GenericTab = ({ type }: GenericTabProps) => {
  const { currentPersonaDocStore } = useCustomizeStore();
  const { tab } = useParams<{ tab: EntityTabs }>();

  const layout = useMemo(() => {
    if (!currentPersonaDocStore) {
      return getDefaultWidgetForTab(type, tab);
    }

    const page = currentPersonaDocStore?.data?.pages?.find(
      (p: Page) => p.pageType === type
    );

    if (page) {
      return page.tabs.find((t: Tab) => t.id === tab)?.layout;
    } else {
      return getDefaultWidgetForTab(type, tab);
    }
  }, [currentPersonaDocStore, tab, type]);

  const widgets = useMemo(() => {
    return layout.map((widget: WidgetConfig) => {
      const renderedWidget = getWidgetsFromKey(type, widget);

      return renderedWidget ? (
        <div
          data-grid={widget}
          id={widget.i}
          key={widget.i}
          style={{ overflow: 'scroll' }}>
          {renderedWidget}
        </div>
      ) : null;
    });
  }, [layout, type]);

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  return (
    <ReactGridLayout
      className="grid-container"
      cols={8}
      isDraggable={false}
      isResizable={false}
      margin={[16, 16]}
      rowHeight={100}>
      {widgets}
    </ReactGridLayout>
  );
};
