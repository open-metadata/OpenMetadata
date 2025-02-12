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

import { Col, Row, Tabs } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, toString } from 'lodash';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  getEntityDetailsPath,
  getVersionPath,
} from '../../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../../constants/entity.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../../../constants/ResizablePanel.constants';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { DashboardDataModel } from '../../../../generated/entity/data/dashboardDataModel';
import { TagLabel } from '../../../../generated/type/tagLabel';
import { useFqn } from '../../../../hooks/useFqn';
import { FeedCounts } from '../../../../interface/feed.interface';
import { restoreDataModel } from '../../../../rest/dataModelsAPI';
import { getFeedCounts } from '../../../../utils/CommonUtils';
import { getDashboardDataModelDetailPageTabs } from '../../../../utils/DashboardDataModelUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { getTagsWithoutTier } from '../../../../utils/TableUtils';
import { createTagObject } from '../../../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import ActivityThreadPanel from '../../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { withActivityFeed } from '../../../AppRouter/withActivityFeed';
import DescriptionV1 from '../../../common/EntityDescription/DescriptionV1';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import { DataAssetsHeader } from '../../../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import EntityRightPanel from '../../../Entity/EntityRightPanel/EntityRightPanel';
import { GenericProvider } from '../../../GenericProvider/GenericProvider';
import { EntityName } from '../../../Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import { DataModelDetailsProps } from './DataModelDetails.interface';
import ModelTab from './ModelTab/ModelTab.component';

const DataModelDetails = ({
  updateDataModelDetailsState,
  dataModelData,
  dataModelPermissions,
  fetchDataModel,
  createThread,
  handleFollowDataModel,
  handleUpdateTags,
  handleUpdateOwner,
  handleUpdateTier,
  handleUpdateDescription,
  handleColumnUpdateDataModel,
  onUpdateDataModel,
  handleToggleDelete,
  onUpdateVote,
}: DataModelDetailsProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { tab: activeTab } = useParams<{ tab: EntityTabs }>();

  const { fqn: decodedDataModelFQN } = useFqn();

  const [threadLink, setThreadLink] = useState<string>('');
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const { deleted, owners, description, version, entityName, tags } =
    useMemo(() => {
      return {
        deleted: dataModelData?.deleted,
        owners: dataModelData?.owners,
        description: dataModelData?.description,
        version: dataModelData?.version,
        entityName: getEntityName(dataModelData),
        tags: getTagsWithoutTier(dataModelData.tags ?? []),
      };
    }, [dataModelData]);

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.DASHBOARD_DATA_MODEL,
      decodedDataModelFQN,
      handleFeedCount
    );
  };

  useEffect(() => {
    decodedDataModelFQN && getEntityFeedCount();
  }, [decodedDataModelFQN]);

  const handleUpdateDisplayName = async (data: EntityName) => {
    if (isUndefined(dataModelData)) {
      return;
    }

    const updatedData = {
      ...dataModelData,
      displayName: data.displayName,
    };

    await onUpdateDataModel(updatedData);
  };

  const versionHandler = () => {
    history.push(
      getVersionPath(
        EntityType.DASHBOARD_DATA_MODEL,
        decodedDataModelFQN,
        toString(version)
      )
    );
  };

  const onThreadLinkSelect = (link: string) => {
    setThreadLink(link);
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const handleTabChange = (tabValue: EntityTabs) => {
    if (tabValue !== activeTab) {
      history.push({
        pathname: getEntityDetailsPath(
          EntityType.DASHBOARD_DATA_MODEL,
          decodedDataModelFQN,
          tabValue
        ),
      });
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);
    await handleUpdateTags(updatedTags);
  };

  const handleRestoreDataModel = async () => {
    try {
      const { version: newVersion } = await restoreDataModel(
        dataModelData.id ?? ''
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.data-model'),
        }),
        2000
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.data-model'),
        })
      );
    }
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? handleToggleDelete(version) : history.push('/'),
    []
  );

  const {
    editDescriptionPermission,
    editTagsPermission,
    editGlossaryTermsPermission,
    editLineagePermission,
  } = useMemo(() => {
    return {
      editDescriptionPermission:
        (dataModelPermissions.EditAll ||
          dataModelPermissions.EditDescription) &&
        !deleted,
      editGlossaryTermsPermission:
        (dataModelPermissions.EditGlossaryTerms ||
          dataModelPermissions.EditAll) &&
        !deleted,
      editTagsPermission:
        (dataModelPermissions.EditAll || dataModelPermissions.EditTags) &&
        !deleted,
      editLineagePermission:
        (dataModelPermissions.EditAll || dataModelPermissions.EditLineage) &&
        !deleted,
    };
  }, [dataModelPermissions, deleted]);

  const handelExtensionUpdate = useCallback(
    async (updatedDataModel: DashboardDataModel) => {
      await onUpdateDataModel({
        ...dataModelData,
        extension: updatedDataModel.extension,
      });
    },
    [onUpdateDataModel, dataModelData]
  );

  const modelComponent = useMemo(() => {
    return (
      <Row gutter={[0, 16]} wrap={false}>
        <Col className="tab-content-height-with-resizable-panel" span={24}>
          <ResizablePanels
            firstPanel={{
              className: 'entity-resizable-panel-container',
              children: (
                <div className="d-flex flex-col gap-4 p-t-sm m-x-lg">
                  <DescriptionV1
                    description={description}
                    entityName={entityName}
                    entityType={EntityType.DASHBOARD_DATA_MODEL}
                    hasEditAccess={editDescriptionPermission}
                    isDescriptionExpanded={isEmpty(dataModelData.columns)}
                    owner={owners}
                    showActions={!deleted}
                    onDescriptionUpdate={handleUpdateDescription}
                    onThreadLinkSelect={onThreadLinkSelect}
                  />
                  <ModelTab
                    isReadOnly={Boolean(deleted)}
                    onThreadLinkSelect={onThreadLinkSelect}
                  />
                </div>
              ),
              ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
            }}
            secondPanel={{
              children: (
                <div data-testid="entity-right-panel">
                  <EntityRightPanel<EntityType.DASHBOARD_DATA_MODEL>
                    customProperties={dataModelData}
                    dataProducts={dataModelData?.dataProducts ?? []}
                    domain={dataModelData?.domain}
                    editCustomAttributePermission={
                      (dataModelPermissions.EditAll ||
                        dataModelPermissions.EditCustomFields) &&
                      !deleted
                    }
                    editGlossaryTermsPermission={editGlossaryTermsPermission}
                    editTagPermission={editTagsPermission}
                    entityId={dataModelData.id}
                    entityType={EntityType.DASHBOARD_DATA_MODEL}
                    selectedTags={tags}
                    viewAllPermission={dataModelPermissions.ViewAll}
                    onExtensionUpdate={handelExtensionUpdate}
                    onTagSelectionChange={handleTagSelection}
                    onThreadLinkSelect={onThreadLinkSelect}
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
    );
  }, [
    decodedDataModelFQN,
    dataModelData,
    description,
    decodedDataModelFQN,
    editTagsPermission,
    editGlossaryTermsPermission,
    deleted,
    editDescriptionPermission,
    entityName,
    handleTagSelection,
    onThreadLinkSelect,
    handleColumnUpdateDataModel,
    handleUpdateDescription,
  ]);

  const tabs = useMemo(() => {
    const allTabs = getDashboardDataModelDetailPageTabs({
      modelComponent,
      feedCount,
      activeTab,
      handleFeedCount,
      editLineagePermission,
      dataModelData,
      dataModelPermissions,
      deleted: deleted ?? false,
      handelExtensionUpdate,
      getEntityFeedCount,
      fetchDataModel,
    });

    return allTabs;
  }, [
    feedCount.conversationCount,
    feedCount.totalTasksCount,
    dataModelData?.sql,
    modelComponent,
    deleted,
    handleFeedCount,
    editLineagePermission,
  ]);

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.data-model'),
      })}
      title="Data Model Details">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateDataModelDetailsState}
            dataAsset={dataModelData}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            openTaskCount={feedCount.openTaskCount}
            permissions={dataModelPermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={handleFollowDataModel}
            onOwnerUpdate={handleUpdateOwner}
            onRestoreDataAsset={handleRestoreDataModel}
            onTierUpdate={handleUpdateTier}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<DashboardDataModel>
          data={dataModelData}
          permissions={dataModelPermissions}
          type={EntityType.DASHBOARD_DATA_MODEL}
          onUpdate={onUpdateDataModel}>
          <Col span={24}>
            <Tabs
              activeKey={activeTab ?? EntityTabs.MODEL}
              className="entity-details-page-tabs"
              data-testid="tabs"
              items={tabs}
              onChange={(activeKey: string) =>
                handleTabChange(activeKey as EntityTabs)
              }
            />
          </Col>
        </GenericProvider>

        {threadLink ? (
          <ActivityThreadPanel
            createThread={createThread}
            deletePostHandler={deleteFeed}
            open={Boolean(threadLink)}
            postFeedHandler={postFeed}
            threadLink={threadLink}
            updateThreadHandler={updateFeed}
            onCancel={onThreadPanelClose}
          />
        ) : null}
      </Row>
    </PageLayoutV1>
  );
};

export default withActivityFeed<DataModelDetailsProps>(DataModelDetails);
