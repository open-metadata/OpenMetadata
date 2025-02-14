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

import { Col, Row, Tabs } from 'antd';
import { AxiosError } from 'axios';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getEntityDetailsPath, ROUTES } from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../../constants/ResizablePanel.constants';
import LineageProvider from '../../../context/LineageProvider/LineageProvider';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { Metric } from '../../../generated/entity/data/metric';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { TagLabel } from '../../../generated/type/schema';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { restoreMetric } from '../../../rest/metricsAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../utils/EntityUtils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { withActivityFeed } from '../../AppRouter/withActivityFeed';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { DataAssetsHeader } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import EntityRightPanel from '../../Entity/EntityRightPanel/EntityRightPanel';
import { GenericProvider } from '../../GenericProvider/GenericProvider';
import Lineage from '../../Lineage/Lineage.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import MetricExpression from '../MetricExpression/MetricExpression';
import RelatedMetrics from '../RelatedMetrics/RelatedMetrics';
import { MetricDetailsProps } from './MetricDetails.interface';

const MetricDetails: React.FC<MetricDetailsProps> = ({
  metricDetails,
  metricPermissions,
  fetchMetricDetails,
  onFollowMetric,
  onMetricUpdate,
  onToggleDelete,
  onUnFollowMetric,
  onUpdateMetricDetails,
  onVersionChange,
  onUpdateVote,
}: MetricDetailsProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { tab: activeTab = EntityTabs.OVERVIEW } =
    useParams<{ tab: EntityTabs }>();
  const { fqn: decodedMetricFqn } = useFqn();
  const history = useHistory();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const {
    owners,
    deleted,
    description,
    followers = [],
    entityName,
    metricTags,
    tier,
  } = useMemo(
    () => ({
      ...metricDetails,
      tier: getTierTags(metricDetails.tags ?? []),
      metricTags: getTagsWithoutTier(metricDetails.tags ?? []),
      entityName: getEntityName(metricDetails),
    }),
    [metricDetails]
  );

  const { isFollowing } = useMemo(
    () => ({
      isFollowing: followers?.some(({ id }) => id === currentUser?.id),
      followersCount: followers?.length ?? 0,
    }),
    [followers, currentUser]
  );

  const followMetric = async () =>
    isFollowing ? await onUnFollowMetric() : await onFollowMetric();

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...metricDetails,
      displayName: data.displayName,
    };
    await onMetricUpdate(updatedData, 'displayName');
  };
  const onExtensionUpdate = async (updatedData: Metric) => {
    await onMetricUpdate(
      { ...metricDetails, extension: updatedData.extension },
      'extension'
    );
  };

  const handleRestoreMetric = async () => {
    try {
      const { version: newVersion } = await restoreMetric(metricDetails.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.metric'),
        }),
        2000
      );
      onToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.metric'),
        })
      );
    }
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(
        getEntityDetailsPath(EntityType.METRIC, decodedMetricFqn, activeKey)
      );
    }
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedMetricDetails = {
        ...metricDetails,
        description: updatedHTML,
      };
      try {
        await onMetricUpdate(updatedMetricDetails, 'description');
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };
  const onOwnerUpdate = useCallback(
    async (newOwners?: Metric['owners']) => {
      const updatedMetricDetails = {
        ...metricDetails,
        owners: newOwners,
      };
      await onMetricUpdate(updatedMetricDetails, 'owners');
    },
    [owners]
  );

  const onTierUpdate = (newTier?: Tag) => {
    const tierTag = updateTierTag(metricDetails?.tags ?? [], newTier);
    const updatedMetricDetails = {
      ...metricDetails,
      tags: tierTag,
    };

    return onMetricUpdate(updatedMetricDetails, 'tags');
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && metricDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedMetric = { ...metricDetails, tags: updatedTags };
      await onMetricUpdate(updatedMetric, 'tags');
    }
  };

  const onDataProductsUpdate = async (updatedData: DataProduct[]) => {
    const dataProductsEntity = updatedData?.map((item) => {
      return getEntityReferenceFromEntity(item, EntityType.DATA_PRODUCT);
    });

    const updatedMetricDetails = {
      ...metricDetails,
      dataProducts: dataProductsEntity,
    };

    await onMetricUpdate(updatedMetricDetails, 'dataProducts');
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.METRIC, decodedMetricFqn, handleFeedCount);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? onToggleDelete(version) : history.push(ROUTES.METRICS),
    []
  );

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editAllPermission,
    editLineagePermission,
    viewSampleDataPermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (metricPermissions.EditTags || metricPermissions.EditAll) && !deleted,
      editGlossaryTermsPermission:
        (metricPermissions.EditGlossaryTerms || metricPermissions.EditAll) &&
        !deleted,
      editDescriptionPermission:
        (metricPermissions.EditDescription || metricPermissions.EditAll) &&
        !deleted,
      editCustomAttributePermission:
        (metricPermissions.EditAll || metricPermissions.EditCustomFields) &&
        !deleted,
      editAllPermission: metricPermissions.EditAll && !deleted,
      editLineagePermission:
        (metricPermissions.EditAll || metricPermissions.EditLineage) &&
        !deleted,
      viewSampleDataPermission:
        metricPermissions.ViewAll || metricPermissions.ViewSampleData,
      viewAllPermission: metricPermissions.ViewAll,
    }),
    [metricPermissions, deleted]
  );

  useEffect(() => {
    getEntityFeedCount();
  }, [metricPermissions, decodedMetricFqn]);

  const tabs = useMemo(
    () => [
      {
        label: (
          <TabsLabel id={EntityTabs.OVERVIEW} name={t('label.overview')} />
        ),
        key: EntityTabs.OVERVIEW,
        children: (
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="tab-content-height-with-resizable-panel" span={24}>
              <ResizablePanels
                firstPanel={{
                  className: 'entity-resizable-panel-container',
                  children: (
                    <div className="d-flex flex-col gap-4 p-y-sm m-x-lg">
                      <DescriptionV1
                        isDescriptionExpanded
                        description={metricDetails.description}
                        entityName={entityName}
                        entityType={EntityType.METRIC}
                        hasEditAccess={editDescriptionPermission}
                        owner={metricDetails.owners}
                        showActions={!deleted}
                        onDescriptionUpdate={onDescriptionUpdate}
                      />
                    </div>
                  ),
                  ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
                }}
                secondPanel={{
                  children: (
                    <div data-testid="entity-right-panel">
                      <EntityRightPanel<EntityType.METRIC>
                        afterSlot={
                          <div className="w-full m-t-md m-b-md">
                            <RelatedMetrics
                              hasEditPermission={metricPermissions.EditAll}
                              metricDetails={metricDetails}
                              onMetricUpdate={onMetricUpdate}
                            />
                          </div>
                        }
                        customProperties={metricDetails}
                        dataProducts={metricDetails?.dataProducts ?? []}
                        domain={metricDetails?.domain}
                        editCustomAttributePermission={
                          editCustomAttributePermission
                        }
                        editGlossaryTermsPermission={
                          editGlossaryTermsPermission
                        }
                        editTagPermission={editTagsPermission}
                        entityId={metricDetails.id}
                        entityType={EntityType.METRIC}
                        selectedTags={metricTags}
                        viewAllPermission={viewAllPermission}
                        onExtensionUpdate={onExtensionUpdate}
                        onTagSelectionChange={handleTagSelection}
                      />
                    </div>
                  ),
                  ...COMMON_RESIZABLE_PANEL_CONFIG.RIGHT_PANEL,
                  className:
                    'entity-resizable-right-panel-container entity-resizable-panel-container',
                }}
              />
            </Col>
          </Row>
        ),
      },
      {
        label: (
          <TabsLabel id={EntityTabs.EXPRESSION} name={t('label.expression')} />
        ),
        key: EntityTabs.EXPRESSION,
        children: (
          <div className="p-t-sm m-x-lg">
            <MetricExpression
              metricDetails={metricDetails}
              onMetricUpdate={onMetricUpdate}
            />
          </div>
        ),
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
            entityType={EntityType.METRIC}
            onFeedUpdate={getEntityFeedCount}
            onUpdateEntityDetails={fetchMetricDetails}
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
              deleted={metricDetails.deleted}
              entity={metricDetails as SourceType}
              entityType={EntityType.METRIC}
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
        children: metricDetails && (
          <div className="m-sm">
            <CustomPropertyTable<EntityType.METRIC>
              entityDetails={metricDetails}
              entityType={EntityType.METRIC}
              handleExtensionUpdate={onExtensionUpdate}
              hasEditAccess={editCustomAttributePermission}
              hasPermission={viewAllPermission}
            />
          </div>
        ),
      },
    ],
    [
      activeTab,
      feedCount.totalCount,
      metricTags,
      entityName,
      metricDetails,
      decodedMetricFqn,
      fetchMetricDetails,
      deleted,
      handleFeedCount,
      onExtensionUpdate,
      handleTagSelection,
      onDescriptionUpdate,
      onDataProductsUpdate,
      editTagsPermission,
      editGlossaryTermsPermission,
      editDescriptionPermission,
      editCustomAttributePermission,
      editLineagePermission,
      editAllPermission,
      viewSampleDataPermission,
      viewAllPermission,
    ]
  );

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.metric'),
      })}>
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={onUpdateMetricDetails}
            dataAsset={metricDetails}
            entityType={EntityType.METRIC}
            openTaskCount={feedCount.openTaskCount}
            permissions={metricPermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followMetric}
            onMetricUpdate={onMetricUpdate}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreMetric}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={onVersionChange}
          />
        </Col>
        <GenericProvider<Metric>
          data={metricDetails}
          permissions={metricPermissions}
          type={EntityType.METRIC}
          onUpdate={onMetricUpdate}>
          <Col span={24}>
            <Tabs
              activeKey={activeTab ?? EntityTabs.OVERVIEW}
              className="entity-details-page-tabs"
              data-testid="tabs"
              items={tabs}
              onChange={handleTabChange}
            />
          </Col>
        </GenericProvider>
      </Row>
      <LimitWrapper resource="metric">
        <></>
      </LimitWrapper>
    </PageLayoutV1>
  );
};

export default withActivityFeed<MetricDetailsProps>(MetricDetails);
