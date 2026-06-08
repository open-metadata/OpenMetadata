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
export {
  ContainerFields,
  extractContainerColumns,
  updateContainerColumnDescription,
  updateContainerColumnTags,
} from './ContainerDetailPureUtils';

import { Col, Row } from 'antd';
import { get } from 'lodash';
import { lazy } from 'react';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import type {
  CustomPropertyProps,
  ExtentionEntitiesKeys,
} from '../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../components/common/Loader/Loader';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { ContainerWidget } from '../components/Container/ContainerWidget/ContainerWidget';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../enums/common.enum';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { PageType } from '../generated/system/ui/uiCustomization';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { ContainerDetailPageTabProps } from './ContainerDetailsClassBase';
import { t } from './i18next/LocalUtil';

const CustomPropertyTable = withSuspenseFallback(
  lazy(() =>
    import('../components/common/CustomPropertyTable/CustomPropertyTable').then(
      (module) => ({ default: module.CustomPropertyTable })
    )
  )
) as <T extends ExtentionEntitiesKeys>(
  props: CustomPropertyProps<T>
) => JSX.Element;

const EntityLineageTab = lazy(() =>
  import('../components/Lineage/EntityLineageTab/EntityLineageTab').then(
    (module) => ({ default: module.EntityLineageTab })
  )
);

const ActivityFeedTab = withSuspenseFallback(
  lazy(() =>
    import(
      '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component'
    ).then((module) => ({ default: module.ActivityFeedTab }))
  )
);

const ContractTab = withSuspenseFallback(
  lazy(() =>
    import('../components/DataContract/ContractTab/ContractTab').then(
      (module) => ({ default: module.ContractTab })
    )
  )
);

const ContainerChildren = withSuspenseFallback(
  lazy(
    () => import('../components/Container/ContainerChildren/ContainerChildren')
  )
);

const SampleDataTableComponent = withSuspenseFallback(
  lazy(
    () =>
      import('../components/Database/SampleDataTable/SampleDataTable.component')
  )
);

export const getContainerDetailPageTabs = ({
  isDataModelEmpty,
  decodedContainerName,
  editLineagePermission,
  editCustomAttributePermission,
  viewCustomPropertiesPermission,
  viewSampleDataPermission,
  feedCount,
  getEntityFeedCount,
  handleFeedCount,
  tab,
  deleted,
  containerData,
  containerPermissions,
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
                name={
                  labelMap?.[EntityTabs.CHILDREN] ?? t('label.container-plural')
                }
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
                name={
                  labelMap?.[EntityTabs.CHILDREN] ?? t('label.container-plural')
                }
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

    ...(!isDataModelEmpty
      ? [
          {
            label: (
              <TabsLabel
                id={EntityTabs.SAMPLE_DATA}
                name={get(
                  labelMap,
                  EntityTabs.SAMPLE_DATA,
                  t('label.sample-data')
                )}
              />
            ),
            key: EntityTabs.SAMPLE_DATA,
            children: !viewSampleDataPermission ? (
              <ErrorPlaceHolder
                className="border-none"
                permissionValue={t('label.view-entity', {
                  entity: t('label.sample-data'),
                })}
                type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
              />
            ) : (
              <SampleDataTableComponent
                entityType={EntityType.CONTAINER}
                isTableDeleted={deleted}
                owners={containerData?.owners ?? []}
                permissions={containerPermissions}
                tableId={containerData?.id ?? ''}
              />
            ),
          },
        ]
      : []),

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
        <Suspense fallback={<Loader />}>
          <EntityLineageTab
            deleted={Boolean(deleted)}
            entity={containerData as SourceType}
            entityType={EntityType.CONTAINER}
            hasEditAccess={editLineagePermission}
          />
        </Suspense>
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CONTRACT}
          name={get(labelMap, EntityTabs.CONTRACT, t('label.contract'))}
        />
      ),
      key: EntityTabs.CONTRACT,
      children: <ContractTab />,
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
          hasPermission={viewCustomPropertiesPermission}
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
