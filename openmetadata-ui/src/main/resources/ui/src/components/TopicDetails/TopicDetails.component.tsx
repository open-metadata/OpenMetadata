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

import { Card } from 'antd';
import { AxiosError } from 'axios';
import { ENTITY_CARD_CLASS } from 'constants/entity.constants';
import { EntityTags, ExtraInfo } from 'Models';
import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { restoreTopic } from 'rest/topicsAPI';
import { getEntityName } from 'utils/EntityUtils';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityField } from '../../constants/Feeds.constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { EntityInfo, EntityType } from '../../enums/entity.enum';
import { OwnerType } from '../../enums/user.enum';
import { Topic } from '../../generated/entity/data/topic';
import { ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { LabelType, State } from '../../generated/type/tagLabel';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import {
  getCurrentUserId,
  getEntityPlaceHolder,
  getOwnerValue,
  refreshPage,
} from '../../utils/CommonUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { bytesToSize } from '../../utils/StringsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { getConfigObject } from '../../utils/TopicDetailsUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from '../common/CustomPropertyTable/CustomPropertyTable.interface';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainerV1 from '../containers/PageContainerV1';
import EntityLineageComponent from '../EntityLineage/EntityLineage.component';
import Loader from '../Loader/Loader';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../PermissionProvider/PermissionProvider.interface';
import SampleDataTopic from '../SampleDataTopic/SampleDataTopic';
import SchemaEditor from '../schema-editor/SchemaEditor';
import { TopicDetailsProps } from './TopicDetails.interface';
import TopicSchemaFields from './TopicSchema/TopicSchema';

const TopicDetails: React.FC<TopicDetailsProps> = ({
  topicDetails,
  activeTab,
  slashedTopicName,
  setActiveTabHandler,
  settingsUpdateHandler,
  followTopicHandler,
  unfollowTopicHandler,
  descriptionUpdateHandler,
  tagUpdateHandler,
  versionHandler,
  entityThread,
  isentityThreadLoading,
  postFeedHandler,
  feedCount,
  entityFieldThreadCount,
  createThread,
  topicFQN,
  deletePostHandler,
  paging,
  fetchFeedHandler,
  updateThreadHandler,
  entityFieldTaskCount,
  onExtensionUpdate,
}: TopicDetailsProps) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const [threadLink, setThreadLink] = useState<string>('');
  const [elementRef, isInView] = useInfiniteScroll(observerOptions);
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );

  const [topicPermissions, setTopicPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const { getEntityPermission } = usePermissionProvider();
  const {
    partitions,
    replicationFactor,
    maximumMessageSize,
    retentionSize,
    cleanupPolicies,
    owner,
    description,
    followers = [],
    entityName,
    deleted,
    version,
    tier,
    topicTags,
  } = useMemo(() => {
    return {
      ...topicDetails,
      tier: getTierTags(topicDetails.tags ?? []),
      topicTags: getTagsWithoutTier(topicDetails.tags ?? []),
      entityName: getEntityName(topicDetails),
    };
  }, [topicDetails]);

  const { isFollowing, followersCount } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === getCurrentUserId()),
      followersCount: followers?.length ?? 0,
    };
  }, [followers]);

  const fetchResourcePermission = useCallback(async () => {
    try {
      const permissions = await getEntityPermission(
        ResourceEntity.TOPIC,
        topicDetails.id
      );
      setTopicPermissions(permissions);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', { entity: t('label.topic') })
      );
    }
  }, [topicDetails.id, getEntityPermission, setTopicPermissions]);

  useEffect(() => {
    if (topicDetails.id) {
      fetchResourcePermission();
    }
  }, [topicDetails.id]);

  const getConfigDetails = () => {
    return [
      {
        key: EntityInfo.PARTITIONS,
        value: `${partitions} ${t('label.partition-plural')}`,
      },
      {
        key: EntityInfo.REPLICATION_FACTOR,
        value: `${replicationFactor} ${t('label.replication-factor')}`,
      },
      {
        key: EntityInfo.RETENTION_SIZE,
        value: `${bytesToSize(retentionSize ?? 0)}  ${t(
          'label.retention-size'
        )}`,
      },
      {
        key: EntityInfo.CLEAN_UP_POLICIES,
        value: `${(cleanupPolicies ?? []).join(', ')} ${t(
          'label.clean-up-policy-plural-lowercase'
        )}`,
      },
      {
        key: EntityInfo.MAX_MESSAGE_SIZE,
        value: `${bytesToSize(maximumMessageSize ?? 0)} ${t(
          'label.maximum-size-lowercase'
        )} `,
      },
    ];
  };

  const tabs = [
    {
      name: t('label.schema'),
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Schema',
        selectedName: 'icon-schemacolor',
      },
      isProtected: false,
      position: 1,
    },
    {
      name: t('label.activity-feed-and-task-plural'),
      icon: {
        alt: 'activity_feed',
        name: 'activity_feed',
        title: 'Activity Feed',
        selectedName: 'activity-feed-color',
      },
      isProtected: false,
      position: 2,
      count: feedCount,
    },
    {
      name: t('label.sample-data'),
      icon: {
        alt: 'sample_data',
        name: 'sample-data',
        title: 'Sample Data',
        selectedName: 'sample-data-color',
      },
      isProtected: false,
      position: 3,
    },
    {
      name: t('label.config'),
      icon: {
        alt: 'config',
        name: 'icon-config',
        title: 'Config',
        selectedName: 'icon-configcolor',
      },
      isProtected: false,
      position: 4,
    },
    {
      name: t('label.lineage'),
      icon: {
        alt: 'lineage',
        name: 'icon-lineage',
        title: 'Lineage',
        selectedName: 'icon-lineagecolor',
      },
      isProtected: false,
      position: 5,
    },
    {
      name: t('label.custom-property-plural'),
      isProtected: false,
      position: 6,
    },
  ];

  const extraInfo: Array<ExtraInfo> = [
    {
      key: EntityInfo.OWNER,
      value: getOwnerValue(owner),
      placeholderText: getEntityPlaceHolder(
        getEntityName(owner),
        owner?.deleted
      ),
      isLink: true,
      openInNewTab: false,
      profileName: owner?.type === OwnerType.USER ? owner?.name : undefined,
    },
    {
      key: EntityInfo.TIER,
      value: tier?.tagFQN ? tier.tagFQN.split(FQN_SEPARATOR_CHAR)[1] : '',
    },
    ...getConfigDetails(),
  ];

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };
  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedTopicDetails = {
        ...topicDetails,
        description: updatedHTML,
      };
      try {
        await descriptionUpdateHandler(updatedTopicDetails);
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
    (newOwner?: Topic['owner']) => {
      const updatedTopicDetails = {
        ...topicDetails,
        owner: newOwner
          ? {
              ...owner,
              ...newOwner,
            }
          : undefined,
      };
      settingsUpdateHandler(updatedTopicDetails);
    },
    [owner]
  );

  const onTierRemove = () => {
    if (topicDetails) {
      const updatedTopicDetails = {
        ...topicDetails,
        tags: getTagsWithoutTier(topicDetails.tags ?? []),
      };
      settingsUpdateHandler(updatedTopicDetails);
    }
  };

  const onTierUpdate = (newTier?: string) => {
    if (newTier) {
      const tierTag: Topic['tags'] = newTier
        ? [
            ...getTagsWithoutTier(topicDetails.tags as Array<EntityTags>),
            {
              tagFQN: newTier,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ]
        : topicDetails.tags;
      const updatedTopicDetails = {
        ...topicDetails,
        tags: tierTag,
      };

      return settingsUpdateHandler(updatedTopicDetails);
    } else {
      return Promise.reject();
    }
  };

  const handleRestoreTopic = async () => {
    try {
      await restoreTopic(topicDetails.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.topic'),
        }),
        2000
      );
      refreshPage();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.topic'),
        })
      );
    }
  };

  const followTopic = () => {
    isFollowing ? unfollowTopicHandler() : followTopicHandler();
  };

  const onTagUpdate = (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTopic = { ...topicDetails, tags: updatedTags };
      tagUpdateHandler(updatedTopic);
    }
  };

  const onThreadLinkSelect = (link: string, threadType?: ThreadType) => {
    setThreadLink(link);
    if (threadType) {
      setThreadType(threadType);
    }
  };
  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const getLoader = () => {
    return isentityThreadLoading ? <Loader /> : null;
  };

  const fetchMoreThread = (
    isElementInView: boolean,
    pagingObj: Paging,
    isLoading: boolean
  ) => {
    if (isElementInView && pagingObj?.after && !isLoading) {
      fetchFeedHandler(pagingObj.after);
    }
  };

  const handleSchemaFieldsUpdate = async (
    updatedMessageSchema: Topic['messageSchema']
  ) => {
    try {
      await settingsUpdateHandler({
        ...topicDetails,
        messageSchema: updatedMessageSchema,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    fetchMoreThread(isInView as boolean, paging, isentityThreadLoading);
  }, [paging, isentityThreadLoading, isInView]);

  const handleFeedFilterChange = useCallback(
    (feedFilter, threadType) => {
      fetchFeedHandler(paging.after, feedFilter, threadType);
    },
    [paging]
  );

  return (
    <PageContainerV1>
      <div className="entity-details-container">
        <EntityPageInfo
          canDelete={topicPermissions.Delete}
          currentOwner={topicDetails.owner}
          deleted={deleted}
          entityFieldTasks={getEntityFieldThreadCounts(
            EntityField.TAGS,
            entityFieldTaskCount
          )}
          entityFieldThreads={getEntityFieldThreadCounts(
            EntityField.TAGS,
            entityFieldThreadCount
          )}
          entityFqn={topicFQN}
          entityId={topicDetails.id}
          entityName={entityName}
          entityType={EntityType.TOPIC}
          extraInfo={extraInfo}
          followHandler={followTopic}
          followers={followersCount}
          followersList={followers}
          isFollowing={isFollowing}
          isTagEditable={topicPermissions.EditAll || topicPermissions.EditTags}
          removeTier={
            topicPermissions.EditAll || topicPermissions.EditTier
              ? onTierRemove
              : undefined
          }
          serviceType={topicDetails.serviceType ?? ''}
          tags={topicTags}
          tagsHandler={onTagUpdate}
          tier={tier}
          titleLinks={slashedTopicName}
          updateOwner={
            topicPermissions.EditAll || topicPermissions.EditOwner
              ? onOwnerUpdate
              : undefined
          }
          updateTier={
            topicPermissions.EditAll || topicPermissions.EditTier
              ? onTierUpdate
              : undefined
          }
          version={version}
          versionHandler={versionHandler}
          onRestoreEntity={handleRestoreTopic}
          onThreadLinkSelect={onThreadLinkSelect}
        />
        <div className="tw-mt-4 tw-flex tw-flex-col tw-flex-grow">
          <TabsPane
            activeTab={activeTab}
            setActiveTab={setActiveTabHandler}
            tabs={tabs}
          />

          {activeTab === 1 && (
            <Card className={ENTITY_CARD_CLASS}>
              <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
                <div className="tw-col-span-full">
                  <Description
                    description={description}
                    entityFieldTasks={getEntityFieldThreadCounts(
                      EntityField.DESCRIPTION,
                      entityFieldTaskCount
                    )}
                    entityFieldThreads={getEntityFieldThreadCounts(
                      EntityField.DESCRIPTION,
                      entityFieldThreadCount
                    )}
                    entityFqn={topicFQN}
                    entityName={entityName}
                    entityType={EntityType.TOPIC}
                    hasEditAccess={
                      topicPermissions.EditAll ||
                      topicPermissions.EditDescription
                    }
                    isEdit={isEdit}
                    isReadOnly={deleted}
                    owner={owner}
                    onCancel={onCancel}
                    onDescriptionEdit={onDescriptionEdit}
                    onDescriptionUpdate={onDescriptionUpdate}
                    onThreadLinkSelect={onThreadLinkSelect}
                  />
                </div>
              </div>
              <TopicSchemaFields
                hasDescriptionEditAccess={
                  topicPermissions.EditAll || topicPermissions.EditDescription
                }
                hasTagEditAccess={
                  topicPermissions.EditAll || topicPermissions.EditTags
                }
                isReadOnly={Boolean(deleted)}
                messageSchema={topicDetails.messageSchema}
                onUpdate={handleSchemaFieldsUpdate}
              />
            </Card>
          )}
          {activeTab === 2 && (
            <Card className={ENTITY_CARD_CLASS}>
              <div
                className="tw-py-4 tw-px-7 tw-grid tw-grid-cols-3 entity-feed-list tw--mx-7 tw--my-4 "
                id="activityfeed">
                <div />
                <ActivityFeedList
                  isEntityFeed
                  withSidePanel
                  className=""
                  deletePostHandler={deletePostHandler}
                  entityName={entityName}
                  feedList={entityThread}
                  isFeedLoading={isentityThreadLoading}
                  postFeedHandler={postFeedHandler}
                  updateThreadHandler={updateThreadHandler}
                  onFeedFiltersUpdate={handleFeedFilterChange}
                />
                <div />
              </div>
            </Card>
          )}
          {activeTab === 3 && (
            <Card className={ENTITY_CARD_CLASS} data-testid="sample-data">
              <SampleDataTopic topicFQN={topicFQN} />
            </Card>
          )}
          {activeTab === 4 && (
            <Card className={ENTITY_CARD_CLASS} data-testid="config">
              <SchemaEditor
                value={JSON.stringify(getConfigObject(topicDetails))}
              />
            </Card>
          )}
          {activeTab === 5 && (
            <Card
              className={`${ENTITY_CARD_CLASS} card-body-full`}
              data-testid="lineage-details">
              <EntityLineageComponent
                entityType={EntityType.TOPIC}
                hasEditAccess={
                  topicPermissions.EditAll || topicPermissions.EditLineage
                }
              />
            </Card>
          )}
          {activeTab === 6 && (
            <Card className={ENTITY_CARD_CLASS}>
              <CustomPropertyTable
                entityDetails={
                  topicDetails as CustomPropertyProps['entityDetails']
                }
                entityType={EntityType.TOPIC}
                handleExtensionUpdate={onExtensionUpdate}
                hasEditAccess={
                  topicPermissions.EditAll || topicPermissions.EditCustomFields
                }
              />
            </Card>
          )}
          <div
            data-testid="observer-element"
            id="observer-element"
            ref={elementRef as RefObject<HTMLDivElement>}>
            {getLoader()}
          </div>
          {threadLink ? (
            <ActivityThreadPanel
              createThread={createThread}
              deletePostHandler={deletePostHandler}
              open={Boolean(threadLink)}
              postFeedHandler={postFeedHandler}
              threadLink={threadLink}
              threadType={threadType}
              updateThreadHandler={updateThreadHandler}
              onCancel={onThreadPanelClose}
            />
          ) : null}
        </div>
      </div>
    </PageContainerV1>
  );
};

export default TopicDetails;
