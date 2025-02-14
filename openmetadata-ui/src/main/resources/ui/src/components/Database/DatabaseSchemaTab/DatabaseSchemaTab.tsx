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
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../../enums/entity.enum';
import { Page, PageType, Tab } from '../../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { useCustomizeStore } from '../../../pages/CustomizablePage/CustomizeStore';
import { getDefaultWidgetForTab } from '../../../utils/CustomizePage/CustomizePageUtils';
import databaseClassBase from '../../../utils/Database/DatabaseClassBase';
import { CommonWidgets } from '../../DataAssets/CommonWidgets/CommonWidgets';
import { DatabaseSchemaTable } from '../DatabaseSchema/DatabaseSchemaTable/DatabaseSchemaTable';

const ReactGridLayout = WidthProvider(RGL);

export const DatabaseSchemaTab = () => {
  const { currentPersonaDocStore } = useCustomizeStore();
  const { tab = EntityTabs.SCHEMA } = useParams<{ tab: EntityTabs }>();

  const layout = useMemo(() => {
    if (!currentPersonaDocStore) {
      return databaseClassBase.getDefaultLayout(tab);
    }

    const page = currentPersonaDocStore?.data?.pages?.find(
      (p: Page) => p.pageType === PageType.Database
    );

    if (page) {
      return page.tabs.find((t: Tab) => t.id === tab)?.layout;
    } else {
      return getDefaultWidgetForTab(PageType.Database, tab);
    }
  }, [currentPersonaDocStore, tab]);

  const widgets = useMemo(() => {
    const getWidgetFromKeyInternal = (
      widgetConfig: WidgetConfig
    ): JSX.Element | null => {
      if (widgetConfig.i.startsWith(DetailPageWidgetKeys.DATABASE_SCHEMA)) {
        return <DatabaseSchemaTable />;
      } else {
        return <CommonWidgets widgetConfig={widgetConfig} />;
      }
    };

    return layout.map((widget: WidgetConfig) => (
      <div
        data-grid={widget}
        id={widget.i}
        key={widget.i}
        style={{ overflow: 'scroll' }}>
        {getWidgetFromKeyInternal(widget)}
      </div>
    ));
  }, [layout]);

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  return (
    <>
      <ReactGridLayout
        className="grid-container"
        cols={8}
        isDraggable={false}
        isResizable={false}
        margin={[16, 16]}
        rowHeight={100}>
        {widgets}
      </ReactGridLayout>
    </>
  );
};
