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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import LineageProvider from '../../../context/LineageProvider/LineageProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { Topic } from '../../../generated/entity/data/topic';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { PageType } from '../../../generated/system/ui/page';
import { TagLabel } from '../../../generated/type/schema';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { restoreTopic } from '../../../rest/topicsAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import {
  createTagObject,
  updateCertificationTag,
  updateTierTag,
} from '../../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import topicClassBase from '../../../utils/TopicClassBase';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { withActivityFeed } from '../../AppRouter/withActivityFeed';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { AlignRightIconButton } from '../../common/IconButtons/EditIconButton';
import Loader from '../../common/Loader/Loader';
import QueryViewer from '../../common/QueryViewer/QueryViewer.component';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import SampleDataWithMessages from '../../Database/SampleDataWithMessages/SampleDataWithMessages';
import Lineage from '../../Lineage/Lineage.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import { TopicDetailsProps } from './TopicDetails.interface';

const TopicDetails: React.FC<TopicDetailsProps> = ({
  updateTopicDetailsState,
  topicDetails,
  fetchTopic,
  followTopicHandler,
  unFollowTopicHandler,
  versionHandler,
  onTopicUpdate,
  topicPermissions,
  handleToggleDelete,
  onUpdateVote,
}: TopicDetailsProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { tab: activeTab = EntityTabs.SCHEMA } =
    useRequiredParams<{ tab: EntityTabs }>();
  const { fqn: decodedTopicFQN } = useFqn();
  const navigate = useNavigate();
  const { customizedPage, isLoading } = useCustomPages(PageType.Topic);
  const [isTabExpanded, setIsTabExpanded] = useState(false);

  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const {
    owners,
    deleted,
    description,
    followers = [],
    entityName,
    topicTags,
    tier,
  } = useMemo(
    () => ({
      ...topicDetails,
      tier: getTierTags(topicDetails.tags ?? []),
      topicTags: getTagsWithoutTier(topicDetails.tags ?? []),
      entityName: getEntityName(topicDetails),
    }),
    [topicDetails]
  );

  const { isFollowing } = useMemo(
    () => ({
      isFollowing: followers?.some(({ id }) => id === currentUser?.id),
      followersCount: followers?.length ?? 0,
    }),
    [followers, currentUser]
  );

  const followTopic = async () =>
    isFollowing ? await unFollowTopicHandler() : await followTopicHandler();

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...topicDetails,
      displayName: data.displayName,
    };
    await onTopicUpdate(updatedData, 'displayName');
  };
  const onExtensionUpdate = async (updatedData: Topic) => {
    await onTopicUpdate(
      { ...topicDetails, extension: updatedData.extension },
      'extension'
    );
  };

  const handleSchemaFieldsUpdate = async (
    updatedMessageSchema: Topic['messageSchema']
  ) => {
    try {
      await onTopicUpdate(
        {
          ...topicDetails,
          messageSchema: updatedMessageSchema,
        },
        'messageSchema'
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleRestoreTopic = async () => {
    try {
      const { version: newVersion } = await restoreTopic(topicDetails.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.topic'),
        })
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.topic'),
        })
      );
    }
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(
        getEntityDetailsPath(EntityType.TOPIC, decodedTopicFQN, activeKey),
        { replace: true }
      );
    }
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedTopicDetails = {
        ...topicDetails,
        description: updatedHTML,
      };
      try {
        await onTopicUpdate(updatedTopicDetails, 'description');
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };
  const onOwnerUpdate = useCallback(
    async (newOwners?: Topic['owners']) => {
      const updatedTopicDetails = {
        ...topicDetails,
        owners: newOwners,
      };
      await onTopicUpdate(updatedTopicDetails, 'owners');
    },
    [owners]
  );

  const onTierUpdate = (newTier?: Tag) => {
    const tierTag = updateTierTag(topicDetails?.tags ?? [], newTier);
    const updatedTopicDetails = {
      ...topicDetails,
      tags: tierTag,
    };

    return onTopicUpdate(updatedTopicDetails, 'tags');
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && topicDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTopic = { ...topicDetails, tags: updatedTags };
      await onTopicUpdate(updatedTopic, 'tags');
    }
  };

  const onDataProductsUpdate = async (updatedData: DataProduct[]) => {
    const dataProductsEntity = updatedData?.map((item) => {
      return getEntityReferenceFromEntity(item, EntityType.DATA_PRODUCT);
    });

    const updatedTopicDetails = {
      ...topicDetails,
      dataProducts: dataProductsEntity,
    };

    await onTopicUpdate(updatedTopicDetails, 'dataProducts');
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.TOPIC, decodedTopicFQN, handleFeedCount);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
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
        (topicPermissions.EditTags || topicPermissions.EditAll) && !deleted,
      editGlossaryTermsPermission:
        (topicPermissions.EditGlossaryTerms || topicPermissions.EditAll) &&
        !deleted,
      editDescriptionPermission:
        (topicPermissions.EditDescription || topicPermissions.EditAll) &&
        !deleted,
      editCustomAttributePermission:
        (topicPermissions.EditAll || topicPermissions.EditCustomFields) &&
        !deleted,
      editAllPermission: topicPermissions.EditAll && !deleted,
      editLineagePermission:
        (topicPermissions.EditAll || topicPermissions.EditLineage) && !deleted,
      viewSampleDataPermission:
        topicPermissions.ViewAll || topicPermissions.ViewSampleData,
      viewAllPermission: topicPermissions.ViewAll,
    }),
    [topicPermissions, deleted]
  );

  useEffect(() => {
    getEntityFeedCount();
  }, [topicPermissions, decodedTopicFQN]);

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = topicClassBase.getTopicDetailPageTabs({
      schemaCount: topicDetails.messageSchema?.schemaFields?.length ?? 0,
      activityFeedTab: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.TOPIC}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchTopic}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
      sampleDataTab: !viewSampleDataPermission ? (
        <div className="border-default border-radius-sm p-y-lg">
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
          entityId={topicDetails.id}
          entityType={EntityType.TOPIC}
        />
      ),
      queryViewerTab: (
        <QueryViewer
          isActive={activeTab === EntityTabs.CONFIG}
          sqlQuery={JSON.stringify(topicDetails.topicConfig)}
          title={t('label.config')}
        />
      ),
      lineageTab: (
        <LineageProvider>
          <Lineage
            deleted={topicDetails.deleted}
            entity={topicDetails as SourceType}
            entityType={EntityType.TOPIC}
            hasEditAccess={editLineagePermission}
          />
        </LineageProvider>
      ),
      customPropertiesTab: topicDetails && (
        <CustomPropertyTable<EntityType.TOPIC>
          entityType={EntityType.TOPIC}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewAllPermission}
        />
      ),
      viewSampleDataPermission,
      activeTab,
      feedCount,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.SCHEMA
    );
  }, [
    activeTab,
    feedCount.totalCount,
    topicTags,
    entityName,
    topicDetails,
    decodedTopicFQN,
    fetchTopic,
    deleted,
    handleFeedCount,
    onExtensionUpdate,
    handleTagSelection,
    onDescriptionUpdate,
    onDataProductsUpdate,
    handleSchemaFieldsUpdate,
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editLineagePermission,
    editAllPermission,
    viewSampleDataPermission,
    viewAllPermission,
  ]);
  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      if (topicDetails) {
        const certificationTag: Topic['certification'] =
          updateCertificationTag(newCertification);
        const updatedTopicDetails = {
          ...topicDetails,
          certification: certificationTag,
        };

        await onTopicUpdate(updatedTopicDetails, 'certification');
      }
    },
    [topicDetails, onTopicUpdate]
  );

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], activeTab, PageType.Topic),
    [tabs[0], activeTab]
  );
  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.topic'),
      })}>
      <Row gutter={[0, 12]}>
        <Col span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateTopicDetailsState}
            dataAsset={topicDetails}
            entityType={EntityType.TOPIC}
            openTaskCount={feedCount.openTaskCount}
            permissions={topicPermissions}
            onCertificationUpdate={onCertificationUpdate}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followTopic}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreTopic}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<Topic>
          customizedPage={customizedPage}
          data={topicDetails}
          isTabExpanded={isTabExpanded}
          permissions={topicPermissions}
          type={EntityType.TOPIC}
          onUpdate={onTopicUpdate}>
          <Col className="entity-details-page-tabs" span={24}>
            <Tabs
              activeKey={activeTab}
              className="tabs-new"
              data-testid="tabs"
              items={tabs}
              tabBarExtraContent={
                isExpandViewSupported && (
                  <AlignRightIconButton
                    className={isTabExpanded ? 'rotate-180' : ''}
                    title={
                      isTabExpanded ? t('label.collapse') : t('label.expand')
                    }
                    onClick={toggleTabExpanded}
                  />
                )
              }
              onChange={handleTabChange}
            />
          </Col>
        </GenericProvider>
      </Row>
      <LimitWrapper resource="topic">
        <></>
      </LimitWrapper>
    </PageLayoutV1>
  );
};

export default withActivityFeed<TopicDetailsProps>(TopicDetails);
