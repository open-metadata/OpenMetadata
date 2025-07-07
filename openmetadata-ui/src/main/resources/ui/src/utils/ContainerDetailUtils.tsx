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
import { Col, Row } from 'antd';
import { isEmpty, omit } from 'lodash';
import { EntityTags } from 'Models';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import ContainerChildren from '../components/Container/ContainerChildren/ContainerChildren';
import { ContainerWidget } from '../components/Container/ContainerWidget/ContainerWidget';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import Lineage from '../components/Lineage/Lineage.component';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import LineageProvider from '../context/LineageProvider/LineageProvider';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import {
  Column,
  ContainerDataModel as ContainerDataModelType,
} from '../generated/entity/data/container';
import { PageType } from '../generated/system/ui/uiCustomization';
import { LabelType, State, TagLabel } from '../generated/type/tagLabel';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { ContainerDetailPageTabProps } from './ContainerDetailsClassBase';
import { t } from './i18next/LocalUtil';

const getUpdatedContainerColumnTags = (
  containerColumn: Column,
  newContainerColumnTags: EntityTags[] = []
) => {
  const newTagsFqnList = newContainerColumnTags.map((newTag) => newTag.tagFQN);

  const prevTags = containerColumn?.tags?.filter((tag) =>
    newTagsFqnList.includes(tag.tagFQN)
  );

  const prevTagsFqnList = prevTags?.map((prevTag) => prevTag.tagFQN);

  const newTags: EntityTags[] = newContainerColumnTags.reduce((prev, curr) => {
    const isExistingTag = prevTagsFqnList?.includes(curr.tagFQN);

    return isExistingTag
      ? prev
      : [
          ...prev,
          {
            ...omit(curr, 'isRemovable'),
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ];
  }, [] as EntityTags[]);

  return [...(prevTags as TagLabel[]), ...newTags];
};

export const updateContainerColumnTags = (
  containerColumns: ContainerDataModelType['columns'] = [],
  changedColumnFQN: string,
  newColumnTags: EntityTags[] = []
) => {
  containerColumns.forEach((containerColumn) => {
    if (containerColumn.fullyQualifiedName === changedColumnFQN) {
      containerColumn.tags = getUpdatedContainerColumnTags(
        containerColumn,
        newColumnTags
      );
    } else {
      const hasChildren = !isEmpty(containerColumn.children);

      // stop condition
      if (hasChildren) {
        updateContainerColumnTags(
          containerColumn.children,
          changedColumnFQN,
          newColumnTags
        );
      }
    }
  });
};

export const updateContainerColumnDescription = (
  containerColumns: ContainerDataModelType['columns'] = [],
  changedColumnFQN: string,
  description: string
) => {
  containerColumns.forEach((containerColumn) => {
    if (containerColumn.fullyQualifiedName === changedColumnFQN) {
      containerColumn.description = description;
    } else {
      const hasChildren = !isEmpty(containerColumn.children);

      // stop condition
      if (hasChildren) {
        updateContainerColumnDescription(
          containerColumn.children,
          changedColumnFQN,
          description
        );
      }
    }
  });
};

// eslint-disable-next-line max-len
export const ContainerFields = `${TabSpecificField.TAGS}, ${TabSpecificField.OWNERS},${TabSpecificField.FOLLOWERS},${TabSpecificField.DATAMODEL}, ${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS}`;

export const getContainerDetailPageTabs = ({
  isDataModelEmpty,
  decodedContainerName,
  editLineagePermission,
  editCustomAttributePermission,
  viewAllPermission,
  feedCount,
  getEntityFeedCount,
  handleFeedCount,
  tab,
  deleted,
  containerData,
  fetchContainerDetail,
  labelMap,
  childrenCount,
}: ContainerDetailPageTabProps) => {
  return [
    ...(isDataModelEmpty
      ? [
          {
            label: (
              <TabsLabel
                count={childrenCount}
                id={EntityTabs.CHILDREN}
                name={labelMap?.[EntityTabs.CHILDREN] ?? t('label.children')}
              />
            ),
            key: EntityTabs.CHILDREN,
            children: <GenericTab type={PageType.Container} />,
          },
        ]
      : [
          {
            label: (
              <TabsLabel
                count={containerData?.dataModel?.columns?.length}
                id={EntityTabs.SCHEMA}
                name={labelMap?.[EntityTabs.SCHEMA] ?? t('label.schema')}
              />
            ),
            key: EntityTabs.SCHEMA,
            children: <GenericTab type={PageType.Container} />,
          },
          {
            label: (
              <TabsLabel
                count={childrenCount}
                id={EntityTabs.CHILDREN}
                name={t('label.children')}
              />
            ),
            key: EntityTabs.CHILDREN,
            children: (
              <Row className="p-md" gutter={[0, 16]}>
                <Col span={24}>
                  <ContainerChildren />
                </Col>
              </Row>
            ),
          },
        ]),

    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={tab === EntityTabs.ACTIVITY_FEED}
          name={t('label.activity-feed-and-task-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.CONTAINER}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={() =>
            fetchContainerDetail(decodedContainerName)
          }
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
            entity={containerData as SourceType}
            entityType={EntityType.CONTAINER}
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
      children: containerData && (
        <CustomPropertyTable<EntityType.CONTAINER>
          entityType={EntityType.CONTAINER}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewAllPermission}
        />
      ),
    },
  ];
};

export const getContainerWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (
    widgetConfig.i.startsWith(DetailPageWidgetKeys.CONTAINER_CHILDREN) ||
    widgetConfig.i.startsWith(DetailPageWidgetKeys.CONTAINER_SCHEMA)
  ) {
    return <ContainerWidget />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.CONTAINER}
      widgetConfig={widgetConfig}
    />
  );
};
