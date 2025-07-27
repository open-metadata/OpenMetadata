/*
 *  Copyright 2023 Collate.
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

import { uniqueId } from 'lodash';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import QueryViewer from '../components/common/QueryViewer/QueryViewer.component';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import SampleDataWithMessages from '../components/Database/SampleDataWithMessages/SampleDataWithMessages';
import Lineage from '../components/Lineage/Lineage.component';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import LineageProvider from '../context/LineageProvider/LineageProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../enums/common.enum';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { SearchIndexField } from '../generated/entity/data/searchIndex';
import { PageType } from '../generated/system/ui/page';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import SearchIndexFieldsTab from '../pages/SearchIndexDetailsPage/SearchIndexFieldsTab/SearchIndexFieldsTab';
import { t } from './i18next/LocalUtil';
import { SearchIndexDetailPageTabProps } from './SearchIndexDetailsClassBase';

// eslint-disable-next-line max-len
export const defaultFields = `${TabSpecificField.FIELDS},${TabSpecificField.FOLLOWERS},${TabSpecificField.TAGS},${TabSpecificField.OWNERS},${TabSpecificField.DOMAINS},${TabSpecificField.VOTES},${TabSpecificField.DATA_PRODUCTS},${TabSpecificField.EXTENSION}`;

export const makeData = (
  columns: SearchIndexField[] = []
): Array<SearchIndexField & { id: string }> => {
  return columns.map((column) => ({
    ...column,
    id: uniqueId(column.name),
    children: column.children ? makeData(column.children) : undefined,
  }));
};

export const getSearchIndexDetailsTabs = ({
  searchIndexDetails,
  viewAllPermission,
  feedCount,
  activeTab,
  getEntityFeedCount,
  fetchSearchIndexDetails,
  handleFeedCount,
  viewSampleDataPermission,
  deleted,
  editLineagePermission,
  editCustomAttributePermission,
  labelMap,
}: SearchIndexDetailPageTabProps) => {
  return [
    {
      label: (
        <TabsLabel
          id={EntityTabs.FIELDS}
          name={labelMap?.[EntityTabs.FIELDS] ?? t('label.field-plural')}
        />
      ),
      key: EntityTabs.FIELDS,
      children: <GenericTab type={PageType.SearchIndex} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={
            labelMap?.[EntityTabs.ACTIVITY_FEED] ??
            t('label.activity-feed-and-task-plural')
          }
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.SEARCH_INDEX}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          owners={searchIndexDetails?.owners}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchSearchIndexDetails}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.SAMPLE_DATA}
          name={labelMap?.[EntityTabs.SAMPLE_DATA] ?? t('label.sample-data')}
        />
      ),
      key: EntityTabs.SAMPLE_DATA,
      children: !viewSampleDataPermission ? (
        <div className="m-t-xlg">
          <ErrorPlaceHolder
            className="border-none"
            permissionValue={t('label.view-entity', {
              entity: t('label.sample-data'),
            })}
            type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
          />
        </div>
      ) : (
        <SampleDataWithMessages
          entityId={searchIndexDetails?.id ?? ''}
          entityType={EntityType.SEARCH_INDEX}
        />
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.LINEAGE}
          name={labelMap?.[EntityTabs.LINEAGE] ?? t('label.lineage')}
        />
      ),
      key: EntityTabs.LINEAGE,
      children: (
        <LineageProvider>
          <Lineage
            deleted={deleted}
            entity={searchIndexDetails as SourceType}
            entityType={EntityType.SEARCH_INDEX}
            hasEditAccess={editLineagePermission}
          />
        </LineageProvider>
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.SEARCH_INDEX_SETTINGS}
          name={
            labelMap?.[EntityTabs.SEARCH_INDEX_SETTINGS] ??
            t('label.search-index-setting-plural')
          }
        />
      ),
      key: EntityTabs.SEARCH_INDEX_SETTINGS,
      children: (
        <QueryViewer
          isActive={activeTab === EntityTabs.SEARCH_INDEX_SETTINGS}
          sqlQuery={JSON.stringify(searchIndexDetails?.searchIndexSettings)}
          title={t('label.search-index-setting-plural')}
        />
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CUSTOM_PROPERTIES}
          name={
            labelMap?.[EntityTabs.CUSTOM_PROPERTIES] ??
            t('label.custom-property-plural')
          }
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: searchIndexDetails && (
        <CustomPropertyTable<EntityType.SEARCH_INDEX>
          entityType={EntityType.SEARCH_INDEX}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewAllPermission}
        />
      ),
    },
  ];
};

export const getSearchIndexWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.SEARCH_INDEX_FIELDS)) {
    return <SearchIndexFieldsTab />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.SEARCH_INDEX}
      widgetConfig={widgetConfig}
    />
  );
};
