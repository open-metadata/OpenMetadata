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
import type { AxiosError } from 'axios';
import type { EntityTags } from 'Models';
import type { ComponentType } from 'react';
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import type { Tag } from '../../../generated/entity/classification/tag';
import type { Topic } from '../../../generated/entity/data/topic';
import type { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Operation } from '../../../generated/entity/policies/accessControl/resourcePermission';
import { PageType } from '../../../generated/system/ui/page';
import type { TagLabel } from '../../../generated/type/schema';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import type { FeedCounts } from '../../../interface/feed.interface';
import { restoreTopic } from '../../../rest/topicsAPI';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageEntityTabUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityReferenceUtils';
import {
  fetchEntityActivityCountInto,
  fetchEntityTaskCountsInto,
  getFeedCounts,
} from '../../../utils/FeedUtilsPure';
import {
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from '../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TablePureUtils';
import {
  createTagObject,
  updateCertificationTag,
  updateTierTag,
} from '../../../utils/TagsPureUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import topicClassBase from '../../../utils/TopicClassBase';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { ActivityFeedLayoutType } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { withActivityFeed } from '../../AppRouter/withActivityFeed';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import type {
  CustomPropertyProps,
  ExtentionEntitiesKeys,
} from '../../common/CustomPropertyTable/CustomPropertyTable.interface';
import type { IconButtonProps } from '../../common/IconButtons/EditIconButton';
import Loader from '../../common/Loader/Loader';
import type { GenericProviderProps } from '../../Customization/GenericProvider/GenericProvider.interface';
import type { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import type { SourceType } from '../../SearchedData/SearchedData.interface';
import type { TopicDetailsProps } from './TopicDetails.interface';

type CustomPropertyTableComponent = <T extends ExtentionEntitiesKeys>(
  props: CustomPropertyProps<T>
) => JSX.Element;

type GenericProviderComponent = <T extends Topic>(
  props: GenericProviderProps<T>
) => JSX.Element;

const ActivityFeedTab = withSuspenseFallback(
  lazy(() =>
    import('../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component').then(
      (module) => ({ default: module.ActivityFeedTab })
    )
  )
);

const CustomPropertyTable = withSuspenseFallback(
  lazy(() =>
    import('../../common/CustomPropertyTable/CustomPropertyTable').then(
      (module) => ({ default: module.CustomPropertyTable })
    )
  )
) as CustomPropertyTableComponent;

const ErrorPlaceHolder = withSuspenseFallback(
  lazy(() => import('../../common/ErrorWithPlaceholder/ErrorPlaceHolder'))
);

const GenericProvider = withSuspenseFallback(
  lazy(() =>
    import('../../Customization/GenericProvider/GenericProvider').then(
      (module) => ({ default: module.GenericProvider })
    )
  )
) as GenericProviderComponent;

const DataAssetsHeader = withSuspenseFallback(
  lazy(() =>
    import('../../DataAssets/DataAssetsHeader/DataAssetsHeader.component').then(
      (module) => ({ default: module.DataAssetsHeader })
    )
  )
);

const SampleDataWithMessages = withSuspenseFallback(
  lazy(
    () => import('../../Database/SampleDataWithMessages/SampleDataWithMessages')
  )
);

const EntityLineageTab = withSuspenseFallback(
  lazy(() =>
    import('../../Lineage/EntityLineageTab/EntityLineageTab').then(
      (module) => ({
        default: module.EntityLineageTab,
      })
    )
  )
);

const QueryViewer = withSuspenseFallback(
  lazy(() => import('../../common/QueryViewer/QueryViewer.component'))
);

const AlignRightIconButton = withSuspenseFallback(
  lazy(() =>
    import('../../common/IconButtons/EditIconButton').then((module) => ({
      default: module.AlignRightIconButton,
    }))
  )
) as ComponentType<IconButtonProps>;

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
  const { tab: activeTab = EntityTabs.SCHEMA } = useRequiredParams<{
    tab: EntityTabs;
  }>();
  const navigate = useNavigate();
  const { customizedPage, isLoading } = useCustomPages(PageType.Topic);
  const [isTabExpanded, setIsTabExpanded] = useState(false);

  const { entityFqn: decodedTopicFQN } = useFqn({ type: EntityType.TOPIC });
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

  const fetchTaskCounts = useCallback(() => {
    if (decodedTopicFQN) {
      fetchEntityTaskCountsInto(decodedTopicFQN, setFeedCount);
    }
  }, [decodedTopicFQN]);

  const fetchActivityCount = useCallback(() => {
    if (decodedTopicFQN) {
      fetchEntityActivityCountInto(
        EntityType.TOPIC,
        decodedTopicFQN,
        setFeedCount
      );
    }
  }, [decodedTopicFQN]);

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
    viewCustomPropertiesPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        getPrioritizedEditPermission(topicPermissions, Operation.EditTags) &&
        !deleted,
      editGlossaryTermsPermission:
        getPrioritizedEditPermission(
          topicPermissions,
          Operation.EditGlossaryTerms
        ) && !deleted,
      editDescriptionPermission:
        getPrioritizedEditPermission(
          topicPermissions,
          Operation.EditDescription
        ) && !deleted,
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          topicPermissions,
          Operation.EditCustomFields
        ) && !deleted,
      editAllPermission: topicPermissions.EditAll && !deleted,
      editLineagePermission:
        getPrioritizedEditPermission(topicPermissions, Operation.EditLineage) &&
        !deleted,
      viewSampleDataPermission: getPrioritizedViewPermission(
        topicPermissions,
        Operation.ViewSampleData
      ),
      viewAllPermission: topicPermissions.ViewAll,
      viewCustomPropertiesPermission: getPrioritizedViewPermission(
        topicPermissions,
        Operation.ViewCustomFields
      ),
    }),
    [topicPermissions, deleted]
  );

  useEffect(() => {
    fetchTaskCounts();
    fetchActivityCount();
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
        <EntityLineageTab
          deleted={Boolean(deleted)}
          entity={topicDetails as SourceType}
          entityType={EntityType.TOPIC}
          hasEditAccess={editLineagePermission}
        />
      ),
      customPropertiesTab: topicDetails && (
        <CustomPropertyTable<EntityType.TOPIC>
          entityType={EntityType.TOPIC}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewCustomPropertiesPermission}
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
    viewCustomPropertiesPermission,
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
    <PageLayoutV1 pageTitle={entityName}>
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
