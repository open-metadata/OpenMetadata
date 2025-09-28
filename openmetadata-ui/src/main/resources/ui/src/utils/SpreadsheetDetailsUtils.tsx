/*
 *  Copyright 2022 Collate.
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

import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import WorkflowsTable from '../components/DriveService/Spreadsheet/WorkflowsTable/WorkflowsTable';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { PageType } from '../generated/system/ui/page';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import i18n from './i18next/LocalUtil';
import { SpreadsheetDetailPageTabProps } from './SpreadsheetClassBase';

export const defaultFields = [
  TabSpecificField.OWNERS,
  TabSpecificField.WORKSHEETS,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.TAGS,
  TabSpecificField.DOMAINS,
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.VOTES,
  TabSpecificField.EXTENSION,
  TabSpecificField.MIME_TYPE,
  TabSpecificField.CREATED_TIME,
  TabSpecificField.MODIFIED_TIME,
].join(',');

export const getSpreadsheetDetailsPageTabs = ({
  childrenCount,
  activityFeedTab,
  lineageTab,
  customPropertiesTab,
  activeTab,
  feedCount,
}: SpreadsheetDetailPageTabProps) => {
  return [
    {
      label: (
        <TabsLabel
          count={childrenCount ?? 0}
          id={EntityTabs.WORKSHEETS}
          isActive={activeTab === EntityTabs.WORKSHEETS}
          name={i18n.t('label.worksheet-plural')}
        />
      ),
      key: EntityTabs.WORKSHEETS,
      children: <GenericTab type={PageType.Spreadsheet} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={i18n.t('label.activity-feed-and-task-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: activityFeedTab,
    },
    {
      label: (
        <TabsLabel id={EntityTabs.LINEAGE} name={i18n.t('label.lineage')} />
      ),
      key: EntityTabs.LINEAGE,
      children: lineageTab,
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CUSTOM_PROPERTIES}
          name={i18n.t('label.custom-property-plural')}
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: customPropertiesTab,
    },
  ];
};

export const getSpreadsheetWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.WORKSHEETS)) {
    return <WorkflowsTable />;
  } else {
    return (
      <CommonWidgets
        entityType={EntityType.SPREADSHEET}
        widgetConfig={widgetConfig}
      />
    );
  }
};
