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

import { Col, Row, Tabs } from 'antd';
import { AxiosError } from 'axios';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getEntityDetailsPath } from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../../constants/ResizablePanel.constants';
import LineageProvider from '../../../context/LineageProvider/LineageProvider';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { APIEndpoint } from '../../../generated/entity/data/apiEndpoint';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { TagLabel } from '../../../generated/type/schema';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { restoreApiEndPoint } from '../../../rest/apiEndpointsAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../utils/EntityUtils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useActivityFeedProvider } from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import ActivityThreadPanel from '../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { withActivityFeed } from '../../AppRouter/withActivityFeed';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { DataAssetsHeader } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import EntityRightPanel from '../../Entity/EntityRightPanel/EntityRightPanel';
import Lineage from '../../Lineage/Lineage.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import APIEndpointSchema from '../APIEndpointSchema/APIEndpointSchema';
import { APIEndpointDetailsProps } from './APIEndpointDetails.interface';

const APIEndpointDetails: React.FC<APIEndpointDetailsProps> = ({
  apiEndpointDetails,
  apiEndpointPermissions,
  onCreateThread,
  fetchAPIEndpointDetails,
  onFollowApiEndPoint,
  onApiEndpointUpdate,
  onToggleDelete,
  onUnFollowApiEndPoint,
  onUpdateApiEndpointDetails,
  onVersionChange,
  onUpdateVote,
}: APIEndpointDetailsProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { tab: activeTab = EntityTabs.SCHEMA } =
    useParams<{ tab: EntityTabs }>();
  const { fqn: decodedApiEndpointFqn } = useFqn();
  const history = useHistory();
  const [isEdit, setIsEdit] = useState(false);
  const [threadLink, setThreadLink] = useState<string>('');
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );

  const {
    owners,
    deleted,
    description,
    followers = [],
    entityName,
    apiEndpointTags,
    tier,
  } = useMemo(
    () => ({
      ...apiEndpointDetails,
      tier: getTierTags(apiEndpointDetails.tags ?? []),
      apiEndpointTags: getTagsWithoutTier(apiEndpointDetails.tags ?? []),
      entityName: getEntityName(apiEndpointDetails),
    }),
    [apiEndpointDetails]
  );

  const { isFollowing } = useMemo(
    () => ({
      isFollowing: followers?.some(({ id }) => id === currentUser?.id),
      followersCount: followers?.length ?? 0,
    }),
    [followers, currentUser]
  );

  const followApiEndpoint = async () =>
    isFollowing ? await onUnFollowApiEndPoint() : await onFollowApiEndPoint();

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...apiEndpointDetails,
      displayName: data.displayName,
    };
    await onApiEndpointUpdate(updatedData, 'displayName');
  };
  const onExtensionUpdate = async (updatedData: APIEndpoint) => {
    await onApiEndpointUpdate(
      { ...apiEndpointDetails, extension: updatedData.extension },
      'extension'
    );
  };

  const onThreadLinkSelect = (link: string, threadType?: ThreadType) => {
    setThreadLink(link);
    if (threadType) {
      setThreadType(threadType);
    }
  };
  const onThreadPanelClose = () => setThreadLink('');

  const handleRestoreApiEndpoint = async () => {
    try {
      const { version: newVersion } = await restoreApiEndPoint(
        apiEndpointDetails.id
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.api-endpoint'),
        }),
        2000
      );
      onToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.api-endpoint'),
        })
      );
    }
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(
        getEntityDetailsPath(
          EntityType.API_ENDPOINT,
          decodedApiEndpointFqn,
          activeKey
        )
      );
    }
  };

  const onDescriptionEdit = (): void => setIsEdit(true);

  const onCancel = () => setIsEdit(false);

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedApiEndpointDetails = {
        ...apiEndpointDetails,
        description: updatedHTML,
      };
      try {
        await onApiEndpointUpdate(updatedApiEndpointDetails, 'description');
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsEdit(false);
      }
    } else {
      setIsEdit(false);
    }
  };
  const onOwnerUpdate = useCallback(
    async (newOwners?: APIEndpoint['owners']) => {
      const updatedApiEndpointDetails = {
        ...apiEndpointDetails,
        owners: newOwners,
      };
      await onApiEndpointUpdate(updatedApiEndpointDetails, 'owners');
    },
    [owners]
  );

  const onTierUpdate = (newTier?: Tag) => {
    const tierTag = updateTierTag(apiEndpointDetails?.tags ?? [], newTier);
    const updatedApiEndpointDetails = {
      ...apiEndpointDetails,
      tags: tierTag,
    };

    return onApiEndpointUpdate(updatedApiEndpointDetails, 'tags');
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && apiEndpointDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedApiEndpoint = { ...apiEndpointDetails, tags: updatedTags };
      await onApiEndpointUpdate(updatedApiEndpoint, 'tags');
    }
  };

  const onDataProductsUpdate = async (updatedData: DataProduct[]) => {
    const dataProductsEntity = updatedData?.map((item) => {
      return getEntityReferenceFromEntity(item, EntityType.DATA_PRODUCT);
    });

    const updatedApiEndpointDetails = {
      ...apiEndpointDetails,
      dataProducts: dataProductsEntity,
    };

    await onApiEndpointUpdate(updatedApiEndpointDetails, 'dataProducts');
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(
      EntityType.API_ENDPOINT,
      decodedApiEndpointFqn,
      handleFeedCount
    );

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? onToggleDelete(version) : history.push('/'),
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
        (apiEndpointPermissions.EditTags || apiEndpointPermissions.EditAll) &&
        !deleted,
      editGlossaryTermsPermission:
        (apiEndpointPermissions.EditGlossaryTerms ||
          apiEndpointPermissions.EditAll) &&
        !deleted,
      editDescriptionPermission:
        (apiEndpointPermissions.EditDescription ||
          apiEndpointPermissions.EditAll) &&
        !deleted,
      editCustomAttributePermission:
        (apiEndpointPermissions.EditAll ||
          apiEndpointPermissions.EditCustomFields) &&
        !deleted,
      editAllPermission: apiEndpointPermissions.EditAll && !deleted,
      editLineagePermission:
        (apiEndpointPermissions.EditAll ||
          apiEndpointPermissions.EditLineage) &&
        !deleted,
      viewSampleDataPermission:
        apiEndpointPermissions.ViewAll || apiEndpointPermissions.ViewSampleData,
      viewAllPermission: apiEndpointPermissions.ViewAll,
    }),
    [apiEndpointPermissions, deleted]
  );

  useEffect(() => {
    getEntityFeedCount();
  }, [apiEndpointPermissions, decodedApiEndpointFqn]);

  const tabs = useMemo(
    () => [
      {
        label: <TabsLabel id={EntityTabs.SCHEMA} name={t('label.schema')} />,
        key: EntityTabs.SCHEMA,
        children: (
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="tab-content-height-with-resizable-panel" span={24}>
              <ResizablePanels
                firstPanel={{
                  className: 'entity-resizable-panel-container',
                  children: (
                    <div className="d-flex flex-col gap-4 p-t-sm m-x-lg">
                      <DescriptionV1
                        description={apiEndpointDetails.description}
                        entityFqn={decodedApiEndpointFqn}
                        entityName={entityName}
                        entityType={EntityType.API_ENDPOINT}
                        hasEditAccess={editDescriptionPermission}
                        isEdit={isEdit}
                        owner={apiEndpointDetails.owners}
                        showActions={!deleted}
                        onCancel={onCancel}
                        onDescriptionEdit={onDescriptionEdit}
                        onDescriptionUpdate={onDescriptionUpdate}
                        onThreadLinkSelect={onThreadLinkSelect}
                      />
                      <APIEndpointSchema
                        apiEndpointDetails={apiEndpointDetails}
                        permissions={apiEndpointPermissions}
                        onApiEndpointUpdate={onApiEndpointUpdate}
                        onThreadLinkSelect={onThreadLinkSelect}
                      />
                    </div>
                  ),
                  ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
                }}
                secondPanel={{
                  children: (
                    <div data-testid="entity-right-panel">
                      <EntityRightPanel<EntityType.API_ENDPOINT>
                        customProperties={apiEndpointDetails}
                        dataProducts={apiEndpointDetails?.dataProducts ?? []}
                        domain={apiEndpointDetails?.domain}
                        editCustomAttributePermission={
                          editCustomAttributePermission
                        }
                        editGlossaryTermsPermission={
                          editGlossaryTermsPermission
                        }
                        editTagPermission={editTagsPermission}
                        entityFQN={decodedApiEndpointFqn}
                        entityId={apiEndpointDetails.id}
                        entityType={EntityType.API_ENDPOINT}
                        selectedTags={apiEndpointTags}
                        viewAllPermission={viewAllPermission}
                        onExtensionUpdate={onExtensionUpdate}
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
            entityType={EntityType.API_ENDPOINT}
            fqn={apiEndpointDetails?.fullyQualifiedName ?? ''}
            onFeedUpdate={getEntityFeedCount}
            onUpdateEntityDetails={fetchAPIEndpointDetails}
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
              deleted={apiEndpointDetails.deleted}
              entity={apiEndpointDetails as SourceType}
              entityType={EntityType.API_ENDPOINT}
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
        children: apiEndpointDetails && (
          <div className="m-sm">
            <CustomPropertyTable<EntityType.API_ENDPOINT>
              entityDetails={apiEndpointDetails}
              entityType={EntityType.API_ENDPOINT}
              handleExtensionUpdate={onExtensionUpdate}
              hasEditAccess={editCustomAttributePermission}
              hasPermission={viewAllPermission}
            />
          </div>
        ),
      },
    ],

    [
      isEdit,
      activeTab,
      feedCount.totalCount,
      apiEndpointTags,
      entityName,
      apiEndpointDetails,
      decodedApiEndpointFqn,
      fetchAPIEndpointDetails,
      deleted,
      onCancel,
      onDescriptionEdit,
      handleFeedCount,
      onExtensionUpdate,
      onThreadLinkSelect,
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
        entity: t('label.api-endpoint'),
      })}>
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={onUpdateApiEndpointDetails}
            dataAsset={apiEndpointDetails}
            entityType={EntityType.API_ENDPOINT}
            openTaskCount={feedCount.openTaskCount}
            permissions={apiEndpointPermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followApiEndpoint}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreApiEndpoint}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={onVersionChange}
          />
        </Col>
        <Col span={24}>
          <Tabs
            activeKey={activeTab ?? EntityTabs.SCHEMA}
            className="entity-details-page-tabs"
            data-testid="tabs"
            items={tabs}
            onChange={handleTabChange}
          />
        </Col>
      </Row>
      <LimitWrapper resource="apiEndpoint">
        <></>
      </LimitWrapper>

      {threadLink ? (
        <ActivityThreadPanel
          createThread={onCreateThread}
          deletePostHandler={deleteFeed}
          open={Boolean(threadLink)}
          postFeedHandler={postFeed}
          threadLink={threadLink}
          threadType={threadType}
          updateThreadHandler={updateFeed}
          onCancel={onThreadPanelClose}
        />
      ) : null}
    </PageLayoutV1>
  );
};

export default withActivityFeed<APIEndpointDetailsProps>(APIEndpointDetails);
