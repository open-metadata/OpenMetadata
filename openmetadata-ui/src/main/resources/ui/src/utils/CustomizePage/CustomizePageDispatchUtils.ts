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

import type { EntityUnion } from '../../components/Explore/ExplorePage.interface';
import { TAB_LABEL_MAP } from '../../constants/Customize.constants';
import type { CommonWidgetType } from '../../constants/CustomizeWidgets.constants';
import { EntityTabs } from '../../enums/entity.enum';
import type { Tab } from '../../generated/system/ui/page';
import { PageType } from '../../generated/system/ui/page';
import type { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import apiCollectionClassBase from '../APICollection/APICollectionClassBase';
import apiEndpointClassBase from '../APIEndpoints/APIEndpointClassBase';
import chartDetailsClassBase from '../ChartDetailsClassBase';
import containerDetailsClassBase from '../ContainerDetailsClassBase';
import customizeGlossaryPageClassBase from '../CustomizeGlossaryPage/CustomizeGlossaryPage';
import customizeGlossaryTermPageClassBase from '../CustomizeGlossaryTerm/CustomizeGlossaryTermBaseClass';
import dashboardDataModelClassBase from '../DashboardDataModelClassBase';
import dashboardDetailsClassBase from '../DashboardDetailsClassBase';
import databaseClassBase from '../Database/DatabaseClassBase';
import databaseSchemaClassBase from '../DatabaseSchemaClassBase';
import dataMarketplaceClassBase from '../DataMarketplace/DataMarketplaceClassBase';
import dataProductClassBase from '../DataProduct/DataProductClassBase';
import directoryClassBase from '../DirectoryClassBase';
import domainClassBase from '../Domain/DomainClassBase';
import fileClassBase from '../FileClassBase';
import i18n from '../i18next/LocalUtil';
import metricDetailsClassBase from '../MetricEntityUtils/MetricDetailsClassBase';
import mlModelClassBase from '../MlModel/MlModelClassBase';
import pipelineClassBase from '../PipelineClassBase';
import searchIndexClassBase from '../SearchIndexDetailsClassBase';
import spreadsheetClassBase from '../SpreadsheetClassBase';
import storedProcedureClassBase from '../StoredProcedureClassBase';
import tableClassBase from '../TableClassBase';
import tagClassBase from '../TagClassBase';
import topicClassBase from '../TopicClassBase';
import worksheetClassBase from '../WorksheetClassBase';

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
      id: EntityTabs.RELATIONS_GRAPH,
      name: EntityTabs.RELATIONS_GRAPH,
      displayName: i18n.t(TAB_LABEL_MAP[EntityTabs.RELATIONS_GRAPH]),
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.RELATIONS_GRAPH
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
    {
      id: EntityTabs.DATA_OBSERVABILITY,
      name: EntityTabs.DATA_OBSERVABILITY,
      displayName: i18n.t(TAB_LABEL_MAP[EntityTabs.DATA_OBSERVABILITY]),
      layout: customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
        EntityTabs.DATA_OBSERVABILITY
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
      id: EntityTabs.RELATIONS_GRAPH,
      name: EntityTabs.RELATIONS_GRAPH,
      displayName: i18n.t(TAB_LABEL_MAP[EntityTabs.RELATIONS_GRAPH]),
      layout: customizeGlossaryPageClassBase.getDefaultWidgetForTab(
        EntityTabs.RELATIONS_GRAPH
      ),
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
  ];
};

const DEFAULT_TABS_BY_PAGE_TYPE: Partial<Record<PageType, () => Tab[]>> = {
  [PageType.GlossaryTerm]: getGlossaryTermDefaultTabs,
  [PageType.Glossary]: getGlossaryDefaultTabs,
  [PageType.Table]: () => tableClassBase.getTableDetailPageTabsIds(),
  [PageType.Topic]: () => topicClassBase.getTopicDetailPageTabsIds(),
  [PageType.StoredProcedure]: () =>
    storedProcedureClassBase.getStoredProcedureDetailPageTabsIds(),
  [PageType.DashboardDataModel]: () =>
    dashboardDataModelClassBase.getDashboardDataModelDetailPageTabsIds(),
  [PageType.Container]: () =>
    containerDetailsClassBase.getContainerDetailPageTabsIds(),
  [PageType.Database]: () => databaseClassBase.getDatabaseDetailPageTabsIds(),
  [PageType.SearchIndex]: () =>
    searchIndexClassBase.getSearchIndexDetailPageTabsIds(),
  [PageType.DatabaseSchema]: () =>
    databaseSchemaClassBase.getDatabaseSchemaPageTabsIds(),
  [PageType.Pipeline]: () => pipelineClassBase.getPipelineDetailPageTabsIds(),
  [PageType.Dashboard]: () =>
    dashboardDetailsClassBase.getDashboardDetailPageTabsIds(),
  [PageType.Domain]: () => domainClassBase.getDomainDetailPageTabsIds(),
  [PageType.DataMarketplace]: () =>
    dataMarketplaceClassBase.getDataMarketplaceDetailPageTabsIds(),
  [PageType.DataProduct]: () =>
    dataProductClassBase.getDataProductDetailPageTabsIds(),
  [PageType.APICollection]: () =>
    apiCollectionClassBase.getAPICollectionDetailPageTabsIds(),
  [PageType.APIEndpoint]: () =>
    apiEndpointClassBase.getEndpointDetailPageTabsIds(),
  [PageType.Metric]: () => metricDetailsClassBase.getMetricDetailPageTabsIds(),
  [PageType.MlModel]: () => mlModelClassBase.getMlModelDetailPageTabsIds(),
  [PageType.Chart]: () => chartDetailsClassBase.getChartDetailPageTabsIds(),
  [PageType.Directory]: () =>
    directoryClassBase.getDirectoryDetailPageTabsIds(),
  [PageType.File]: () => fileClassBase.getFileDetailPageTabsIds(),
  [PageType.Spreadsheet]: () =>
    spreadsheetClassBase.getSpreadsheetDetailPageTabsIds(),
  [PageType.Worksheet]: () =>
    worksheetClassBase.getWorksheetDetailPageTabsIds(),
};

export const getDefaultTabs = (pageType?: string): Tab[] => {
  const getTabs = DEFAULT_TABS_BY_PAGE_TYPE[pageType as PageType];

  if (getTabs) {
    return getTabs();
  }

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
};

const DEFAULT_WIDGET_BY_PAGE_TYPE: Partial<
  Record<PageType, (tab: EntityTabs) => WidgetConfig[]>
> = {
  [PageType.GlossaryTerm]: (tab) =>
    customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(tab),
  [PageType.Glossary]: (tab) =>
    customizeGlossaryPageClassBase.getDefaultWidgetForTab(tab),
  [PageType.Table]: (tab) => tableClassBase.getDefaultLayout(tab),
  [PageType.Tag]: (tab) => tagClassBase.getDefaultLayout(tab),
  [PageType.Topic]: (tab) => topicClassBase.getDefaultLayout(tab),
  [PageType.DashboardDataModel]: (tab) =>
    dashboardDataModelClassBase.getDefaultLayout(tab),
  [PageType.StoredProcedure]: (tab) =>
    storedProcedureClassBase.getDefaultLayout(tab),
  [PageType.Database]: (tab) => databaseClassBase.getDefaultLayout(tab),
  [PageType.DatabaseSchema]: (tab) =>
    databaseSchemaClassBase.getDefaultLayout(tab),
  [PageType.Pipeline]: (tab) => pipelineClassBase.getDefaultLayout(tab),
  [PageType.SearchIndex]: (tab) => searchIndexClassBase.getDefaultLayout(tab),
  [PageType.Container]: (tab) =>
    containerDetailsClassBase.getDefaultLayout(tab),
  [PageType.Domain]: (tab) => domainClassBase.getDefaultLayout(tab),
  [PageType.DataMarketplace]: (tab) =>
    dataMarketplaceClassBase.getDefaultLayout(tab),
  [PageType.DataProduct]: (tab) => dataProductClassBase.getDefaultLayout(tab),
  [PageType.Dashboard]: (tab) =>
    dashboardDetailsClassBase.getDefaultLayout(tab),
  [PageType.APICollection]: (tab) =>
    apiCollectionClassBase.getDefaultLayout(tab),
  [PageType.APIEndpoint]: (tab) => apiEndpointClassBase.getDefaultLayout(tab),
  [PageType.Metric]: (tab) => metricDetailsClassBase.getDefaultLayout(tab),
  [PageType.MlModel]: (tab) => mlModelClassBase.getDefaultLayout(tab),
  [PageType.Chart]: (tab) => chartDetailsClassBase.getDefaultLayout(tab),
  [PageType.Directory]: (tab) => directoryClassBase.getDefaultLayout(tab),
  [PageType.File]: (tab) => fileClassBase.getDefaultLayout(tab),
  [PageType.Spreadsheet]: (tab) => spreadsheetClassBase.getDefaultLayout(tab),
  [PageType.Worksheet]: (tab) => worksheetClassBase.getDefaultLayout(tab),
};

export const getDefaultWidgetForTab = (pageType: PageType, tab: EntityTabs) => {
  const getWidget = DEFAULT_WIDGET_BY_PAGE_TYPE[pageType];

  return getWidget ? getWidget(tab) : [];
};

const COMMON_WIDGET_BY_PAGE_TYPE: Partial<
  Record<PageType, () => CommonWidgetType[]>
> = {
  [PageType.GlossaryTerm]: () =>
    customizeGlossaryTermPageClassBase.getCommonWidgetList(false),
  [PageType.Glossary]: () =>
    customizeGlossaryTermPageClassBase.getCommonWidgetList(true),
  [PageType.Table]: () => tableClassBase.getCommonWidgetList(),
  [PageType.Tag]: () => tagClassBase.getCommonWidgetList(),
  [PageType.Topic]: () => topicClassBase.getCommonWidgetList(),
  [PageType.Dashboard]: () => dashboardDetailsClassBase.getCommonWidgetList(),
  [PageType.Container]: () => containerDetailsClassBase.getCommonWidgetList(),
  [PageType.Database]: () => databaseClassBase.getCommonWidgetList(),
  [PageType.DatabaseSchema]: () =>
    databaseSchemaClassBase.getCommonWidgetList(),
  [PageType.Pipeline]: () => pipelineClassBase.getCommonWidgetList(),
  [PageType.SearchIndex]: () => searchIndexClassBase.getCommonWidgetList(),
  [PageType.Domain]: () => domainClassBase.getCommonWidgetList(),
  [PageType.DataMarketplace]: () =>
    dataMarketplaceClassBase.getCommonWidgetList(),
  [PageType.DataProduct]: () => dataProductClassBase.getCommonWidgetList(),
  [PageType.APICollection]: () => apiCollectionClassBase.getCommonWidgetList(),
  [PageType.APIEndpoint]: () => apiEndpointClassBase.getCommonWidgetList(),
  [PageType.Metric]: () => metricDetailsClassBase.getCommonWidgetList(),
  [PageType.MlModel]: () => mlModelClassBase.getCommonWidgetList(),
  [PageType.DashboardDataModel]: () =>
    dashboardDataModelClassBase.getCommonWidgetList(),
  [PageType.StoredProcedure]: () =>
    storedProcedureClassBase.getCommonWidgetList(),
  [PageType.Chart]: () => chartDetailsClassBase.getCommonWidgetList(),
  [PageType.Directory]: () => directoryClassBase.getCommonWidgetList(),
  [PageType.File]: () => fileClassBase.getCommonWidgetList(),
  [PageType.Spreadsheet]: () => spreadsheetClassBase.getCommonWidgetList(),
  [PageType.Worksheet]: () => worksheetClassBase.getCommonWidgetList(),
};

export const getCustomizableWidgetByPage = (
  pageType: PageType
): CommonWidgetType[] => {
  const getWidgetList = COMMON_WIDGET_BY_PAGE_TYPE[pageType];

  return getWidgetList ? getWidgetList() : [];
};

const DUMMY_DATA_BY_PAGE_TYPE = {
  [PageType.Table]: () => tableClassBase.getDummyData(),
  [PageType.Tag]: () => tagClassBase.getDummyData(),
  [PageType.Topic]: () => topicClassBase.getDummyData(),
  [PageType.StoredProcedure]: () => storedProcedureClassBase.getDummyData(),
  [PageType.DashboardDataModel]: () =>
    dashboardDataModelClassBase.getDummyData(),
  [PageType.Container]: () => containerDetailsClassBase.getDummyData(),
  [PageType.Database]: () => databaseClassBase.getDummyData(),
  [PageType.DatabaseSchema]: () => databaseSchemaClassBase.getDummyData(),
  [PageType.Pipeline]: () => pipelineClassBase.getDummyData(),
  [PageType.SearchIndex]: () => searchIndexClassBase.getDummyData(),
  [PageType.Dashboard]: () => dashboardDetailsClassBase.getDummyData(),
  [PageType.Domain]: () => domainClassBase.getDummyData(),
  [PageType.DataMarketplace]: () =>
    dataMarketplaceClassBase.getDummyData() as EntityUnion,
  [PageType.DataProduct]: () => dataProductClassBase.getDummyData(),
  [PageType.APICollection]: () => apiCollectionClassBase.getDummyData(),
  [PageType.APIEndpoint]: () => apiEndpointClassBase.getDummyData(),
  [PageType.Metric]: () => metricDetailsClassBase.getDummyData(),
  [PageType.MlModel]: () => mlModelClassBase.getDummyData(),
  [PageType.Chart]: () => chartDetailsClassBase.getDummyData(),
  [PageType.Directory]: () => directoryClassBase.getDummyData(),
  [PageType.File]: () => fileClassBase.getDummyData(),
  [PageType.Spreadsheet]: () => spreadsheetClassBase.getDummyData(),
  [PageType.Worksheet]: () => worksheetClassBase.getDummyData(),
};

export const getDummyDataByPage = (pageType: PageType) => {
  const getDummyData =
    DUMMY_DATA_BY_PAGE_TYPE[pageType as keyof typeof DUMMY_DATA_BY_PAGE_TYPE];

  return getDummyData ? getDummyData() : ({} as EntityUnion);
};

const WIDGETS_FROM_KEY_BY_PAGE_TYPE: Partial<
  Record<PageType, (widgetConfig: WidgetConfig) => JSX.Element | null>
> = {
  [PageType.Table]: (widgetConfig) =>
    tableClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.Tag]: (widgetConfig) =>
    tagClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.Topic]: (widgetConfig) =>
    topicClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.StoredProcedure]: (widgetConfig) =>
    storedProcedureClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.DashboardDataModel]: (widgetConfig) =>
    dashboardDataModelClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.Container]: (widgetConfig) =>
    containerDetailsClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.Database]: (widgetConfig) =>
    databaseClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.DatabaseSchema]: (widgetConfig) =>
    databaseSchemaClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.Pipeline]: (widgetConfig) =>
    pipelineClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.SearchIndex]: (widgetConfig) =>
    searchIndexClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.Dashboard]: (widgetConfig) =>
    dashboardDetailsClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.Domain]: (widgetConfig) =>
    domainClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.DataMarketplace]: (widgetConfig) =>
    dataMarketplaceClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.DataProduct]: (widgetConfig) =>
    dataProductClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.APICollection]: (widgetConfig) =>
    apiCollectionClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.APIEndpoint]: (widgetConfig) =>
    apiEndpointClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.Metric]: (widgetConfig) =>
    metricDetailsClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.MlModel]: (widgetConfig) =>
    mlModelClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.Glossary]: (widgetConfig) =>
    customizeGlossaryPageClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.GlossaryTerm]: (widgetConfig) =>
    customizeGlossaryTermPageClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.Chart]: (widgetConfig) =>
    chartDetailsClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.Directory]: (widgetConfig) =>
    directoryClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.File]: (widgetConfig) =>
    fileClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.Spreadsheet]: (widgetConfig) =>
    spreadsheetClassBase.getWidgetsFromKey(widgetConfig),
  [PageType.Worksheet]: (widgetConfig) =>
    worksheetClassBase.getWidgetsFromKey(widgetConfig),
};

export const getWidgetsFromKey = (
  pageType: PageType,
  widgetConfig: WidgetConfig
): JSX.Element | null => {
  const getWidgets = WIDGETS_FROM_KEY_BY_PAGE_TYPE[pageType];

  return getWidgets ? getWidgets(widgetConfig) : null;
};

const WIDGET_HEIGHT_BY_PAGE_TYPE: Partial<
  Record<PageType, (widgetName: string) => number>
> = {
  [PageType.Table]: (widgetName) => tableClassBase.getWidgetHeight(widgetName),
  [PageType.Tag]: (widgetName) => tagClassBase.getWidgetHeight(widgetName),
  [PageType.Topic]: (widgetName) => topicClassBase.getWidgetHeight(widgetName),
  [PageType.StoredProcedure]: (widgetName) =>
    storedProcedureClassBase.getWidgetHeight(widgetName),
  [PageType.DashboardDataModel]: (widgetName) =>
    dashboardDataModelClassBase.getWidgetHeight(widgetName),
  [PageType.Container]: (widgetName) =>
    containerDetailsClassBase.getWidgetHeight(widgetName),
  [PageType.Database]: (widgetName) =>
    databaseClassBase.getWidgetHeight(widgetName),
  [PageType.DatabaseSchema]: (widgetName) =>
    databaseSchemaClassBase.getWidgetHeight(widgetName),
  [PageType.Pipeline]: (widgetName) =>
    pipelineClassBase.getWidgetHeight(widgetName),
  [PageType.SearchIndex]: (widgetName) =>
    searchIndexClassBase.getWidgetHeight(widgetName),
  [PageType.Dashboard]: (widgetName) =>
    dashboardDetailsClassBase.getWidgetHeight(widgetName),
  [PageType.Domain]: (widgetName) =>
    domainClassBase.getWidgetHeight(widgetName),
  [PageType.DataMarketplace]: (widgetName) =>
    dataMarketplaceClassBase.getWidgetHeight(widgetName),
  [PageType.DataProduct]: (widgetName) =>
    dataProductClassBase.getWidgetHeight(widgetName),
  [PageType.APICollection]: (widgetName) =>
    apiCollectionClassBase.getWidgetHeight(widgetName),
  [PageType.APIEndpoint]: (widgetName) =>
    apiEndpointClassBase.getWidgetHeight(widgetName),
  [PageType.Metric]: (widgetName) =>
    metricDetailsClassBase.getWidgetHeight(widgetName),
  [PageType.MlModel]: (widgetName) =>
    mlModelClassBase.getWidgetHeight(widgetName),
  [PageType.Glossary]: (widgetName) =>
    customizeGlossaryPageClassBase.getWidgetHeight(widgetName),
  [PageType.GlossaryTerm]: (widgetName) =>
    customizeGlossaryTermPageClassBase.getWidgetHeight(widgetName),
  [PageType.Chart]: (widgetName) =>
    chartDetailsClassBase.getWidgetHeight(widgetName),
  [PageType.Directory]: (widgetName) =>
    directoryClassBase.getWidgetHeight(widgetName),
  [PageType.File]: (widgetName) => fileClassBase.getWidgetHeight(widgetName),
  [PageType.Spreadsheet]: (widgetName) =>
    spreadsheetClassBase.getWidgetHeight(widgetName),
  [PageType.Worksheet]: (widgetName) =>
    worksheetClassBase.getWidgetHeight(widgetName),
};

export const getWidgetHeight = (pageType: PageType, widgetName: string) => {
  const getHeight = WIDGET_HEIGHT_BY_PAGE_TYPE[pageType];

  return getHeight ? getHeight(widgetName) : 0;
};
