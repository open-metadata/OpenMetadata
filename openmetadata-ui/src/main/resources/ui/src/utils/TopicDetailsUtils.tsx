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

import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import TopicSchemaFields from '../components/Topic/TopicSchema/TopicSchema';
import { ERROR_PLACEHOLDER_TYPE } from '../enums/common.enum';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { PageType } from '../generated/system/ui/page';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import i18n from './i18next/LocalUtil';
import { TopicDetailPageTabProps } from './TopicClassBase';

export const getTopicDetailsPageTabs = ({
  schemaCount,
  activityFeedTab,
  sampleDataTab,
  queryViewerTab,
  lineageTab,
  customPropertiesTab,
  viewSampleDataPermission,
  activeTab,
  feedCount,
}: TopicDetailPageTabProps) => {
  return [
    {
      label: (
        <TabsLabel
          count={schemaCount ?? 0}
          id={EntityTabs.SCHEMA}
          isActive={activeTab === EntityTabs.SCHEMA}
          name={i18n.t('label.schema')}
        />
      ),
      key: EntityTabs.SCHEMA,
      children: <GenericTab type={PageType.Topic} />,
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
        <TabsLabel
          id={EntityTabs.SAMPLE_DATA}
          name={i18n.t('label.sample-data')}
        />
      ),
      key: EntityTabs.SAMPLE_DATA,
      children: !viewSampleDataPermission ? (
        <div className="border-default border-radius-sm p-y-lg">
          <ErrorPlaceHolder
            className="border-none"
            permissionValue={i18n.t('label.view-entity', {
              entity: i18n.t('label.sample-data'),
            })}
            type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
          />
        </div>
      ) : (
        sampleDataTab
      ),
    },
    {
      label: <TabsLabel id={EntityTabs.CONFIG} name={i18n.t('label.config')} />,
      key: EntityTabs.CONFIG,
      children: queryViewerTab,
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

export const getTopicWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.TOPIC_SCHEMA)) {
    return <TopicSchemaFields />;
  } else {
    return (
      <CommonWidgets
        entityType={EntityType.TOPIC}
        widgetConfig={widgetConfig}
      />
    );
  }
};
