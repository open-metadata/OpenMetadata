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
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import { StoredProcedureCodeCard } from '../components/Database/StoredProcedureCodeCard/StoredProcedureCodeCard';
import Lineage from '../components/Lineage/Lineage.component';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import LineageProvider from '../context/LineageProvider/LineageProvider';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { PageType } from '../generated/system/ui/page';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { t } from './i18next/LocalUtil';
import { StoredProcedureDetailPageTabProps } from './StoredProcedureClassBase';

// eslint-disable-next-line max-len
export const STORED_PROCEDURE_DEFAULT_FIELDS = `${TabSpecificField.OWNERS}, ${TabSpecificField.FOLLOWERS},${TabSpecificField.TAGS}, ${TabSpecificField.DOMAINS},${TabSpecificField.DATA_PRODUCTS}, ${TabSpecificField.VOTES},${TabSpecificField.EXTENSION}`;

export const getStoredProcedureDetailsPageTabs = ({
  activeTab,
  feedCount,
  deleted,
  storedProcedure,
  editLineagePermission,
  editCustomAttributePermission,
  viewAllPermission,
  getEntityFeedCount,
  fetchStoredProcedureDetails,
  handleFeedCount,
}: StoredProcedureDetailPageTabProps) => {
  return [
    {
      label: (
        <TabsLabel
          data-testid={EntityTabs.CODE}
          id={EntityTabs.CODE}
          name={t('label.code')}
        />
      ),
      key: EntityTabs.CODE,
      children: <GenericTab type={PageType.StoredProcedure} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={t('label.activity-feed-and-task-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.STORED_PROCEDURE}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          owners={storedProcedure?.owners}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchStoredProcedureDetails}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
    },
    {
      label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
      key: EntityTabs.LINEAGE,
      children: (
        <LineageProvider>
          <Lineage
            deleted={deleted}
            entity={storedProcedure as SourceType}
            entityType={EntityType.STORED_PROCEDURE}
            hasEditAccess={editLineagePermission}
          />
        </LineageProvider>
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CUSTOM_PROPERTIES}
          name={t('label.custom-property-plural')}
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: storedProcedure && (
        <CustomPropertyTable<EntityType.STORED_PROCEDURE>
          entityType={EntityType.STORED_PROCEDURE}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewAllPermission}
        />
      ),
    },
  ];
};

export const getStoredProcedureWidgetsFromKey = (
  widgetConfig: WidgetConfig
): JSX.Element | null => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.STORED_PROCEDURE_CODE)) {
    return <StoredProcedureCodeCard />;
  } else {
    return (
      <CommonWidgets
        entityType={EntityType.STORED_PROCEDURE}
        widgetConfig={widgetConfig}
      />
    );
  }
};
