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
import { TabsProps } from 'antd';
import { get, noop, uniqueId } from 'lodash';
import { EntityUnion } from '../../components/Explore/ExplorePage.interface';
import { TAB_LABEL_MAP } from '../../constants/Customize.constants';
import { CommonWidgetType } from '../../constants/CustomizeWidgets.constants';
import { LandingPageWidgetKeys } from '../../enums/CustomizablePage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { Page, PageType, Tab } from '../../generated/system/ui/page';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import apiCollectionClassBase from '../APICollection/APICollectionClassBase';
import apiEndpointClassBase from '../APIEndpoints/APIEndpointClassBase';
import chartDetailsClassBase from '../ChartDetailsClassBase';
import containerDetailsClassBase from '../ContainerDetailsClassBase';
import { getNewWidgetPlacement } from '../CustomizableLandingPageUtils';
import customizeGlossaryPageClassBase from '../CustomizeGlossaryPage/CustomizeGlossaryPage';
import customizeGlossaryTermPageClassBase from '../CustomizeGlossaryTerm/CustomizeGlossaryTermBaseClass';
import dashboardDataModelClassBase from '../DashboardDataModelClassBase';
import dashboardDetailsClassBase from '../DashboardDetailsClassBase';
import databaseClassBase from '../Database/DatabaseClassBase';
import databaseSchemaClassBase from '../DatabaseSchemaClassBase';
import domainClassBase from '../Domain/DomainClassBase';
import { getEntityName } from '../EntityUtils';
import i18n from '../i18next/LocalUtil';
import metricDetailsClassBase from '../MetricEntityUtils/MetricDetailsClassBase';
import mlModelClassBase from '../MlModel/MlModelClassBase';
import pipelineClassBase from '../PipelineClassBase';
import searchIndexClassBase from '../SearchIndexDetailsClassBase';
import storedProcedureClassBase from '../StoredProcedureClassBase';
import tableClassBase from '../TableClassBase';
import topicClassBase from '../TopicClassBase';

export const getGlossaryTermDefaultTabs = () => {
  return [
    {
      id: EntityTabs.OVERVIEW,
      displayName: i18n.t(TAB_LABEL_MAP[EntityTabs.OVERVIEW]),
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.OVERVIEW
      ),
      name: EntityTabs.OVERVIEW,
      editable: true,
    },
    {
      id: EntityTabs.GLOSSARY_TERMS,
      displayName: i18n.t(TAB_LABEL_MAP[EntityTabs.GLOSSARY_TERMS]),
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.GLOSSARY_TERMS
      ),
      name: EntityTabs.GLOSSARY_TERMS,
      editable: false,
    },
    {
      id: EntityTabs.ASSETS,
      displayName: i18n.t(TAB_LABEL_MAP[EntityTabs.ASSETS]),
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.ASSETS
      ),
      name: EntityTabs.ASSETS,
      editable: false,
    },
    {
      displayName: i18n.t(TAB_LABEL_MAP[EntityTabs.ACTIVITY_FEED]),
      name: EntityTabs.ACTIVITY_FEED,
      id: EntityTabs.ACTIVITY_FEED,
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.ACTIVITY_FEED
      ),
      editable: false,
    },
    {
      id: EntityTabs.CUSTOM_PROPERTIES,
      name: EntityTabs.CUSTOM_PROPERTIES,
      displayName: i18n.t(TAB_LABEL_MAP[EntityTabs.CUSTOM_PROPERTIES]),
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.CUSTOM_PROPERTIES
      ),
      editable: false,
    },
  ];
};

export const getGlossaryDefaultTabs = () => {
  return [
    {
      id: EntityTabs.TERMS,
      name: EntityTabs.TERMS,
      displayName: i18n.t(TAB_LABEL_MAP[EntityTabs.TERMS]),
      layout: customizeGlossaryPageClassBase.getDefaultWidgetForTab(
        EntityTabs.TERMS
      ),
      editable: true,
    },
    {
      displayName: i18n.t(TAB_LABEL_MAP[EntityTabs.ACTIVITY_FEED]),
      name: EntityTabs.ACTIVITY_FEED,
      id: EntityTabs.ACTIVITY_FEED,
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.ACTIVITY_FEED
      ),
      editable: false,
    },
  ];
};

export const getTabLabelFromId = (tab: EntityTabs): string => {
  const labelKey = TAB_LABEL_MAP[tab];

  return labelKey ? i18n.t(labelKey) : '';
};

export const getDefaultTabs = (pageType?: string): Tab[] => {
  switch (pageType) {
    case PageType.GlossaryTerm:
      return getGlossaryTermDefaultTabs();
    case PageType.Glossary:
      return getGlossaryDefaultTabs();
    case PageType.Table:
      return tableClassBase.getTableDetailPageTabsIds();
    case PageType.Topic:
      return topicClassBase.getTopicDetailPageTabsIds();
    case PageType.StoredProcedure:
      return storedProcedureClassBase.getStoredProcedureDetailPageTabsIds();
    case PageType.DashboardDataModel:
      return dashboardDataModelClassBase.getDashboardDataModelDetailPageTabsIds();
    case PageType.Container:
      return containerDetailsClassBase.getContainerDetailPageTabsIds();
    case PageType.Database:
      return databaseClassBase.getDatabaseDetailPageTabsIds();
    case PageType.SearchIndex:
      return searchIndexClassBase.getSearchIndexDetailPageTabsIds();
    case PageType.DatabaseSchema:
      return databaseSchemaClassBase.getDatabaseSchemaPageTabsIds();
    case PageType.Pipeline:
      return pipelineClassBase.getPipelineDetailPageTabsIds();
    case PageType.Dashboard:
      return dashboardDetailsClassBase.getDashboardDetailPageTabsIds();
    case PageType.Domain:
      return domainClassBase.getDomainDetailPageTabsIds();
    case PageType.APICollection:
      return apiCollectionClassBase.getAPICollectionDetailPageTabsIds();
    case PageType.APIEndpoint:
      return apiEndpointClassBase.getEndpointDetailPageTabsIds();
    case PageType.Metric:
      return metricDetailsClassBase.getMetricDetailPageTabsIds();
    case PageType.MlModel:
      return mlModelClassBase.getMlModelDetailPageTabsIds();
    case PageType.Chart:
      return chartDetailsClassBase.getChartDetailPageTabsIds();
    default:
      return [
        {
          id: EntityTabs.CUSTOM_PROPERTIES,
          name: EntityTabs.CUSTOM_PROPERTIES,
          displayName: i18n.t(TAB_LABEL_MAP[EntityTabs.CUSTOM_PROPERTIES]),
          layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
            EntityTabs.CUSTOM_PROPERTIES
          ),
        },
      ];
  }
};

export const getDefaultWidgetForTab = (pageType: PageType, tab: EntityTabs) => {
  switch (pageType) {
    case PageType.GlossaryTerm:
      return customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(tab);
    case PageType.Glossary:
      return customizeGlossaryPageClassBase.getDefaultWidgetForTab(tab);
    case PageType.Table:
      return tableClassBase.getDefaultLayout(tab);
    case PageType.Topic:
      return topicClassBase.getDefaultLayout(tab);
    case PageType.DashboardDataModel:
      return dashboardDataModelClassBase.getDefaultLayout(tab);
    case PageType.StoredProcedure:
      return storedProcedureClassBase.getDefaultLayout(tab);
    case PageType.Database:
      return databaseClassBase.getDefaultLayout(tab);
    case PageType.DatabaseSchema:
      return databaseSchemaClassBase.getDefaultLayout(tab);
    case PageType.Pipeline:
      return pipelineClassBase.getDefaultLayout(tab);
    case PageType.SearchIndex:
      return searchIndexClassBase.getDefaultLayout(tab);
    case PageType.Container:
      return containerDetailsClassBase.getDefaultLayout(tab);
    case PageType.Domain:
      return domainClassBase.getDefaultLayout(tab);
    case PageType.Dashboard:
      return dashboardDetailsClassBase.getDefaultLayout(tab);
    case PageType.APICollection:
      return apiCollectionClassBase.getDefaultLayout(tab);
    case PageType.APIEndpoint:
      return apiEndpointClassBase.getDefaultLayout(tab);
    case PageType.Metric:
      return metricDetailsClassBase.getDefaultLayout(tab);
    case PageType.MlModel:
      return mlModelClassBase.getDefaultLayout(tab);
    case PageType.Chart:
      return chartDetailsClassBase.getDefaultLayout(tab);
    default:
      return [];
  }
};

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

export const getCustomizableWidgetByPage = (
  pageType: PageType
): CommonWidgetType[] => {
  switch (pageType) {
    case PageType.GlossaryTerm:
    case PageType.Glossary:
      return customizeGlossaryTermPageClassBase.getCommonWidgetList(
        pageType === PageType.Glossary
      );

    case PageType.Table:
      return tableClassBase.getCommonWidgetList();
    case PageType.Topic:
      return topicClassBase.getCommonWidgetList();
    case PageType.Dashboard:
      return dashboardDetailsClassBase.getCommonWidgetList();
    case PageType.Container:
      return containerDetailsClassBase.getCommonWidgetList();
    case PageType.Database:
      return databaseClassBase.getCommonWidgetList();
    case PageType.DatabaseSchema:
      return databaseSchemaClassBase.getCommonWidgetList();
    case PageType.Pipeline:
      return pipelineClassBase.getCommonWidgetList();
    case PageType.SearchIndex:
      return searchIndexClassBase.getCommonWidgetList();
    case PageType.Domain:
      return domainClassBase.getCommonWidgetList();
    case PageType.APICollection:
      return apiCollectionClassBase.getCommonWidgetList();
    case PageType.APIEndpoint:
      return apiEndpointClassBase.getCommonWidgetList();
    case PageType.Metric:
      return metricDetailsClassBase.getCommonWidgetList();
    case PageType.MlModel:
      return mlModelClassBase.getCommonWidgetList();
    case PageType.DashboardDataModel:
      return dashboardDataModelClassBase.getCommonWidgetList();
    case PageType.StoredProcedure:
      return storedProcedureClassBase.getCommonWidgetList();
    case PageType.Chart:
      return chartDetailsClassBase.getCommonWidgetList();
    case PageType.LandingPage:
    default:
      return [];
  }
};

export const getDummyDataByPage = (pageType: PageType) => {
  switch (pageType) {
    case PageType.Table:
      return tableClassBase.getDummyData();
    case PageType.Topic:
      return topicClassBase.getDummyData();
    case PageType.StoredProcedure:
      return storedProcedureClassBase.getDummyData();
    case PageType.DashboardDataModel:
      return dashboardDataModelClassBase.getDummyData();
    case PageType.Container:
      return containerDetailsClassBase.getDummyData();
    case PageType.Database:
      return databaseClassBase.getDummyData();
    case PageType.DatabaseSchema:
      return databaseSchemaClassBase.getDummyData();
    case PageType.Pipeline:
      return pipelineClassBase.getDummyData();
    case PageType.SearchIndex:
      return searchIndexClassBase.getDummyData();
    case PageType.Dashboard:
      return dashboardDetailsClassBase.getDummyData();
    case PageType.Domain:
      return domainClassBase.getDummyData();
    case PageType.APICollection:
      return apiCollectionClassBase.getDummyData();
    case PageType.APIEndpoint:
      return apiEndpointClassBase.getDummyData();
    case PageType.Metric:
      return metricDetailsClassBase.getDummyData();
    case PageType.MlModel:
      return mlModelClassBase.getDummyData();
    case PageType.Chart:
      return chartDetailsClassBase.getDummyData();
    case PageType.LandingPage:
    default:
      return {} as EntityUnion;
  }
};

export const getWidgetsFromKey = (
  pageType: PageType,
  widgetConfig: WidgetConfig
): JSX.Element | null => {
  switch (pageType) {
    case PageType.Table:
      return tableClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.Topic:
      return topicClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.StoredProcedure:
      return storedProcedureClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.DashboardDataModel:
      return dashboardDataModelClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.Container:
      return containerDetailsClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.Database:
      return databaseClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.DatabaseSchema:
      return databaseSchemaClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.Pipeline:
      return pipelineClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.SearchIndex:
      return searchIndexClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.Dashboard:
      return dashboardDetailsClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.Domain:
      return domainClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.APICollection:
      return apiCollectionClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.APIEndpoint:
      return apiEndpointClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.Metric:
      return metricDetailsClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.MlModel:
      return mlModelClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.Glossary:
      return customizeGlossaryPageClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.GlossaryTerm:
      return customizeGlossaryTermPageClassBase.getWidgetsFromKey(widgetConfig);
    case PageType.Chart:
      return chartDetailsClassBase.getWidgetsFromKey(widgetConfig);
    default:
      return null;
  }
};

export const getWidgetHeight = (pageType: PageType, widgetName: string) => {
  switch (pageType) {
    case PageType.Table:
      return tableClassBase.getWidgetHeight(widgetName);

    case PageType.Topic:
      return topicClassBase.getWidgetHeight(widgetName);
    case PageType.StoredProcedure:
      return storedProcedureClassBase.getWidgetHeight(widgetName);
    case PageType.DashboardDataModel:
      return dashboardDataModelClassBase.getWidgetHeight(widgetName);
    case PageType.Container:
      return containerDetailsClassBase.getWidgetHeight(widgetName);
    case PageType.Database:
      return databaseClassBase.getWidgetHeight(widgetName);
    case PageType.DatabaseSchema:
      return databaseSchemaClassBase.getWidgetHeight(widgetName);
    case PageType.Pipeline:
      return pipelineClassBase.getWidgetHeight(widgetName);
    case PageType.SearchIndex:
      return searchIndexClassBase.getWidgetHeight(widgetName);
    case PageType.Dashboard:
      return dashboardDetailsClassBase.getWidgetHeight(widgetName);
    case PageType.Domain:
      return domainClassBase.getWidgetHeight(widgetName);
    case PageType.APICollection:
      return apiCollectionClassBase.getWidgetHeight(widgetName);
    case PageType.APIEndpoint:
      return apiEndpointClassBase.getWidgetHeight(widgetName);
    case PageType.Metric:
      return metricDetailsClassBase.getWidgetHeight(widgetName);
    case PageType.MlModel:
      return mlModelClassBase.getWidgetHeight(widgetName);
    case PageType.Glossary:
      return customizeGlossaryPageClassBase.getWidgetHeight(widgetName);
    case PageType.GlossaryTerm:
      return customizeGlossaryTermPageClassBase.getWidgetHeight(widgetName);
    case PageType.Chart:
      return chartDetailsClassBase.getWidgetHeight(widgetName);
    default:
      return 0;
  }
};

const calculateNewPosition = (
  currentLayout: WidgetConfig[],
  newWidget: { w: number; h: number },
  maxCols = 8
) => {
  // Sort layout by y position to find last row
  const sortedLayout = [...currentLayout].sort(
    (a, b) => a.y + a.h - (b.y + b.h)
  );

  // Get the last widget
  const lastWidget = sortedLayout[sortedLayout.length - 1];

  if (!lastWidget) {
    // If no widgets exist, start at 0,0
    return { x: 0, y: 0 };
  }

  // Calculate next position
  const lastRowY = lastWidget.y + lastWidget.h;
  const lastRowWidgets = sortedLayout.filter(
    (widget) => widget.y + widget.h === lastRowY
  );

  // Find the rightmost x position in the last row
  const lastX = lastRowWidgets.reduce(
    (maxX, widget) => Math.max(maxX, widget.x + widget.w),
    0
  );

  // If there's room in the current row
  if (lastX + newWidget.w <= maxCols) {
    return { x: lastX, y: lastRowY - lastWidget.h };
  }

  // Otherwise, start a new row
  return { x: 0, y: lastRowY };
};

export const getAddWidgetHandler =
  (
    newWidgetData: CommonWidgetType,
    placeholderWidgetKey: string,
    widgetWidth: number,
    pageType: PageType
  ) =>
  (currentLayout: Array<WidgetConfig>): WidgetConfig[] => {
    const widgetFQN = uniqueId(`${newWidgetData.fullyQualifiedName}-`);
    const widgetHeight = getWidgetHeight(
      pageType,
      newWidgetData.fullyQualifiedName
    );

    // The widget with key "ExtraWidget.EmptyWidgetPlaceholder" will always remain in the bottom
    // and is not meant to be replaced hence
    // if placeholderWidgetKey is "ExtraWidget.EmptyWidgetPlaceholder"
    // append the new widget in the array
    // else replace the new widget with other placeholder widgets
    if (
      placeholderWidgetKey === LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
    ) {
      const newPlacement = getNewWidgetPlacement(currentLayout, widgetWidth);

      return [
        ...currentLayout.map((widget) =>
          widget.i === placeholderWidgetKey
            ? // Push down emptyWidget to 1 row
              { ...widget, y: newPlacement.y + 1 }
            : widget
        ),
        {
          i: widgetFQN,
          h: widgetHeight,
          w: widgetWidth,
          static: false,
          ...newPlacement,
        },
      ];
    } else {
      // To handle case of adding widget from top button instead of empty widget placeholder
      const { x: widgetX, y: widgetY } = calculateNewPosition(
        currentLayout.filter(
          (widget) =>
            widget.i !== LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
        ),
        {
          w: widgetWidth,
          h: widgetHeight,
        }
      );

      return [
        ...currentLayout,
        {
          i: widgetFQN,
          h: widgetHeight,
          w: widgetWidth,
          x: widgetX,
          y: widgetY,
        },
      ];
    }
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

export const asyncNoop = async () => {
  noop();
};

export const getLayoutFromCustomizedPage = (
  pageType: PageType,
  tab: EntityTabs,
  customizedPage?: Page | null,
  isVersionView = false
) => {
  if (!customizedPage || isVersionView) {
    return getDefaultWidgetForTab(pageType, tab);
  }

  if (customizedPage?.tabs?.length) {
    return tab
      ? customizedPage.tabs?.find((t: Tab) => t.id === tab)?.layout
      : get(customizedPage, 'tabs.0.layout', []);
  } else {
    return getDefaultWidgetForTab(pageType, tab);
  }
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
    default:
      return false;
  }
};

export const updateWidgetHeightRecursively = (
  widgetId: string,
  height: number,
  widgets: WidgetConfig[]
) =>
  widgets.reduce((acc, widget) => {
    if (widget.i === widgetId) {
      acc.push({ ...widget, h: height });
    } else if (widget.children) {
      acc.push({
        ...widget,
        children: widget.children.map((child) =>
          child.i === widgetId ? { ...child, h: height } : child
        ),
      });
    } else {
      acc.push(widget);
    }

    return acc;
  }, [] as WidgetConfig[]);
