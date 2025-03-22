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
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import RGL, { WidthProvider } from 'react-grid-layout';
import { useParams } from 'react-router-dom';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import { PageType, Tab } from '../../../generated/system/ui/page';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import {
  getDefaultWidgetForTab,
  getWidgetsFromKey,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { useGenericContext } from '../GenericProvider/GenericProvider';
import './generic-tab.less';

const ReactGridLayout = WidthProvider(RGL);

interface GenericTabProps {
  type: PageType;
}

export const GenericTab = ({ type }: GenericTabProps) => {
  const { customizedPage } = useCustomPages(type);
  const { tab } = useParams<{ tab: EntityTabs }>();
  const { data } = useGenericContext<Table>();

  const layout = useMemo(() => {
    if (!customizedPage) {
      return getDefaultWidgetForTab(type, tab);
    }

    if (customizedPage) {
      return tab
        ? customizedPage.tabs?.find((t: Tab) => t.id === tab)?.layout
        : customizedPage.tabs?.[0].layout;
    } else {
      return getDefaultWidgetForTab(type, tab);
    }
  }, [customizedPage, tab, type]);

  const filteredLayout = useMemo(() => {
    if (type !== PageType.Table) {
      return layout;
    }

    const shouldRenderFrequentlyJoinedTables =
      !isEmpty(data?.joins?.columnJoins) ||
      !isEmpty(data?.joins?.directTableJoins);
    const shouldRenderPartitionedKeys = !isEmpty(data?.tablePartition?.columns);
    const shouldRenderTableConstraints = !isEmpty(data?.tableConstraints);

    if (
      shouldRenderFrequentlyJoinedTables &&
      shouldRenderPartitionedKeys &&
      shouldRenderTableConstraints
    ) {
      return layout;
    }

    return layout?.filter((widget: WidgetConfig) => {
      if (widget.i === DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES) {
        return shouldRenderFrequentlyJoinedTables;
      }

      if (widget.i === DetailPageWidgetKeys.PARTITIONED_KEYS) {
        return shouldRenderPartitionedKeys;
      }

      if (widget.i === DetailPageWidgetKeys.TABLE_CONSTRAINTS) {
        return shouldRenderTableConstraints;
      }

      return true;
    });
  }, [
    layout,
    data?.joins,
    data?.tablePartition?.columns,
    data?.tableConstraints,
  ]);

  const widgets = useMemo(() => {
    return filteredLayout?.map((widget: WidgetConfig) => {
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
  }, [filteredLayout, type]);

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
