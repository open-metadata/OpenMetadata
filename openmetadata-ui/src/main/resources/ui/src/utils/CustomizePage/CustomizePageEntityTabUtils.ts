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

import type { TabsProps } from 'antd';
import { EntityTabs } from '../../enums/entity.enum';
import type { Tab } from '../../generated/system/ui/page';
import { PageType } from '../../generated/system/ui/page';
import customizeDetailPageClassBase from '../CustomizeDetailPage/CustomizeDetailPageClassBase';
import { getEntityName } from '../EntityNameUtils';

export const sortTabs = (tabs: TabsProps['items'], order: string[]) => {
  return [...(tabs ?? [])].sort((a, b) => {
    const orderA = order.indexOf(a.key);
    const orderB = order.indexOf(b.key);

    if (orderA !== -1 && orderB !== -1) {
      return orderA - orderB;
    }
    if (orderA !== -1) {
      return -1;
    }
    if (orderB !== -1) {
      return 1;
    }

    const ia = tabs?.indexOf(a) ?? 0;
    const ib = tabs?.indexOf(b) ?? 0;

    return ia - ib;
  });
};

export const getDetailsTabWithNewLabel = (
  defaultTabs: Array<
    NonNullable<TabsProps['items']>[number] & { isHidden?: boolean }
  >,
  customizedTabs?: Tab[],
  defaultTabId: EntityTabs = EntityTabs.OVERVIEW,
  isVersionView = false
) => {
  if (!customizedTabs || isVersionView) {
    return defaultTabs.filter((data) => !data.isHidden);
  }
  const overviewTab = defaultTabs?.find((t) => t.key === defaultTabId);

  const newTabs =
    customizedTabs?.map((t) => {
      const tabItemDetails = defaultTabs?.find((i) => i.key === t.id);

      return (
        tabItemDetails ?? {
          label: getEntityName(t),
          key: t.id,
          children: overviewTab?.children,
        }
      );
    }) ?? defaultTabs;

  return newTabs.filter((data) => !data.isHidden);
};

// Resolve the tab actually on screen: the selected tab only when it is in the rendered
// list, else the first rendered tab (persona order, hidden dropped), else the default.
export const getRenderedActiveTab = (
  tabs: TabsProps['items'],
  selectedTab?: EntityTabs,
  defaultTab: EntityTabs = EntityTabs.OVERVIEW
): EntityTabs =>
  ((selectedTab && tabs?.some((tab) => tab.key === selectedTab)
    ? selectedTab
    : tabs?.[0]?.key) ?? defaultTab) as EntityTabs;

export const getTabLabelMapFromTabs = (
  tabs?: Tab[]
): Record<EntityTabs, string> => {
  const labelMap = {} as Record<EntityTabs, string>;

  return (
    tabs?.reduce((acc: Record<EntityTabs, string>, item) => {
      if (item.id && item.displayName) {
        const tab = item.id as EntityTabs;
        acc[tab] = item.displayName;
      }

      return acc;
    }, labelMap) ?? labelMap
  );
};

// Maps each page type to the tab whose presence enables the expand view.
const EXPAND_VIEW_SUPPORTED_TAB: Partial<Record<PageType, EntityTabs>> = {
  [PageType.Table]: EntityTabs.SCHEMA,
  [PageType.Topic]: EntityTabs.SCHEMA,
  [PageType.APIEndpoint]: EntityTabs.SCHEMA,
  [PageType.Glossary]: EntityTabs.TERMS,
  [PageType.GlossaryTerm]: EntityTabs.OVERVIEW,
  [PageType.Metric]: EntityTabs.OVERVIEW,
  [PageType.File]: EntityTabs.OVERVIEW,
  [PageType.Worksheet]: EntityTabs.OVERVIEW,
  [PageType.Dashboard]: EntityTabs.DETAILS,
  [PageType.DashboardDataModel]: EntityTabs.MODEL,
  [PageType.Container]: EntityTabs.CHILDREN,
  [PageType.Directory]: EntityTabs.CHILDREN,
  [PageType.Database]: EntityTabs.SCHEMAS,
  [PageType.SearchIndex]: EntityTabs.FIELDS,
  [PageType.DatabaseSchema]: EntityTabs.TABLE,
  [PageType.Pipeline]: EntityTabs.TASKS,
  [PageType.APICollection]: EntityTabs.API_ENDPOINT,
  [PageType.StoredProcedure]: EntityTabs.CODE,
  [PageType.MlModel]: EntityTabs.FEATURES,
  [PageType.Spreadsheet]: EntityTabs.WORKSHEETS,
  [PageType.Domain]: EntityTabs.DOCUMENTATION,
  [PageType.DataProduct]: EntityTabs.DOCUMENTATION,
};

export const checkIfExpandViewSupported = (
  firstTab: NonNullable<TabsProps['items']>[number],
  activeTab: EntityTabs,
  pageType: PageType
) => {
  const expandTab = EXPAND_VIEW_SUPPORTED_TAB[pageType];

  if (!expandTab) {
    return false;
  }

  return (!activeTab && firstTab.key === expandTab) || activeTab === expandTab;
};

export const getTabDisplayName = (item: Tab) => {
  return (
    item.displayName ??
    customizeDetailPageClassBase.getTabLabelFromId(item.name as EntityTabs)
  );
};
