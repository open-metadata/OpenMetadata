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

export const checkIfExpandViewSupported = (
  firstTab: NonNullable<TabsProps['items']>[number],
  activeTab: EntityTabs,
  pageType: PageType
) => {
  switch (pageType) {
    case PageType.Table:
    case PageType.Topic:
    case PageType.APIEndpoint:
      return (
        (!activeTab && firstTab.key === EntityTabs.SCHEMA) ||
        activeTab === EntityTabs.SCHEMA
      );

    case PageType.Glossary:
      return (
        (!activeTab && firstTab.key === EntityTabs.TERMS) ||
        activeTab === EntityTabs.TERMS
      );
    case PageType.GlossaryTerm:
    case PageType.Metric:
    case PageType.File:
    case PageType.Worksheet:
      return (
        (!activeTab && firstTab.key === EntityTabs.OVERVIEW) ||
        activeTab === EntityTabs.OVERVIEW
      );
    case PageType.Dashboard:
      return (
        (!activeTab && firstTab.key === EntityTabs.DETAILS) ||
        activeTab === EntityTabs.DETAILS
      );
    case PageType.DashboardDataModel:
      return (
        (!activeTab && firstTab.key === EntityTabs.MODEL) ||
        activeTab === EntityTabs.MODEL
      );
    case PageType.Container:
    case PageType.Directory:
      return (
        (!activeTab && firstTab.key === EntityTabs.CHILDREN) ||
        activeTab === EntityTabs.CHILDREN
      );
    case PageType.Database:
      return (
        (!activeTab && firstTab.key === EntityTabs.SCHEMAS) ||
        activeTab === EntityTabs.SCHEMAS
      );
    case PageType.SearchIndex:
      return (
        (!activeTab && firstTab.key === EntityTabs.FIELDS) ||
        activeTab === EntityTabs.FIELDS
      );
    case PageType.DatabaseSchema:
      return (
        (!activeTab && firstTab.key === EntityTabs.TABLE) ||
        activeTab === EntityTabs.TABLE
      );
    case PageType.Pipeline:
      return (
        (!activeTab && firstTab.key === EntityTabs.TASKS) ||
        activeTab === EntityTabs.TASKS
      );
    case PageType.APICollection:
      return (
        (!activeTab && firstTab.key === EntityTabs.API_ENDPOINT) ||
        activeTab === EntityTabs.API_ENDPOINT
      );

    case PageType.StoredProcedure:
      return (
        (!activeTab && firstTab.key === EntityTabs.CODE) ||
        activeTab === EntityTabs.CODE
      );

    case PageType.MlModel:
      return (
        (!activeTab && firstTab.key === EntityTabs.FEATURES) ||
        activeTab === EntityTabs.FEATURES
      );
    case PageType.Spreadsheet:
      return (
        (!activeTab && firstTab.key === EntityTabs.WORKSHEETS) ||
        activeTab === EntityTabs.WORKSHEETS
      );
    case PageType.Domain:
    case PageType.DataProduct:
      return (
        (!activeTab && firstTab.key === EntityTabs.DOCUMENTATION) ||
        activeTab === EntityTabs.DOCUMENTATION
      );
    default:
      return false;
  }
};

export const getTabDisplayName = (item: Tab) => {
  return (
    item.displayName ??
    customizeDetailPageClassBase.getTabLabelFromId(item.name as EntityTabs)
  );
};
