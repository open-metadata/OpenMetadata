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

import { get } from 'lodash';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import { ContractTab } from '../components/DataContract/ContractTab/ContractTab';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { PageType } from '../generated/system/ui/page';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import i18n from './i18next/LocalUtil';

export interface FileDetailPageTabProps {
  activityFeedTab: JSX.Element;
  lineageTab: JSX.Element;
  customPropertiesTab: JSX.Element;
  activeTab: EntityTabs;
  feedCount: {
    totalCount: number;
  };
  labelMap?: Record<EntityTabs, string>;
}

export const fileDefaultFields = [
  TabSpecificField.OWNERS,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.TAGS,
  TabSpecificField.DOMAINS,
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.VOTES,
  TabSpecificField.EXTENSION,
  TabSpecificField.FILE_TYPE,
  TabSpecificField.FILE_EXTENSION,
  TabSpecificField.FILE_VERSION,
].join(',');

export const getFileDetailsPageTabs = ({
  activityFeedTab,
  lineageTab,
  customPropertiesTab,
  activeTab,
  feedCount,
  labelMap,
}: FileDetailPageTabProps) => {
  return [
    {
      label: (
        <TabsLabel
          id={EntityTabs.OVERVIEW}
          isActive={activeTab === EntityTabs.OVERVIEW}
          name={get(labelMap, EntityTabs.OVERVIEW, i18n.t('label.overview'))}
        />
      ),
      key: EntityTabs.OVERVIEW,
      children: <GenericTab type={PageType.File} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={get(
            labelMap,
            EntityTabs.ACTIVITY_FEED,
            i18n.t('label.activity-feed-and-task-plural')
          )}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: activityFeedTab,
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.LINEAGE}
          name={get(labelMap, EntityTabs.LINEAGE, i18n.t('label.lineage'))}
        />
      ),
      key: EntityTabs.LINEAGE,
      children: lineageTab,
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CONTRACT}
          name={get(labelMap, EntityTabs.CONTRACT, i18n.t('label.contract'))}
        />
      ),
      key: EntityTabs.CONTRACT,
      children: <ContractTab />,
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CUSTOM_PROPERTIES}
          name={get(
            labelMap,
            EntityTabs.CUSTOM_PROPERTIES,
            i18n.t('label.custom-property-plural')
          )}
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: customPropertiesTab,
    },
  ];
};

export const getFileWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  return (
    <CommonWidgets entityType={EntityType.FILE} widgetConfig={widgetConfig} />
  );
};
