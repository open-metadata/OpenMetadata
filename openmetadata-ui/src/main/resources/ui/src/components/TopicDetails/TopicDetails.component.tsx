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

import { Card, Col, Row, Tabs } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { ActivityFilters } from 'components/ActivityFeed/ActivityFeedList/ActivityFeedList.interface';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import { getTopicDetailsPath } from 'constants/constants';
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
import { useHistory, useParams } from 'react-router-dom';
import { restoreTopic } from 'rest/topicsAPI';
import { getEntityBreadcrumbs, getEntityName } from 'utils/EntityUtils';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityField } from '../../constants/Feeds.constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { EntityInfo, EntityTabs, EntityType } from '../../enums/entity.enum';
import { OwnerType } from '../../enums/user.enum';
import { Topic } from '../../generated/entity/data/topic';
import { ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { LabelType, State } from '../../generated/type/tagLabel';
import { useElementInView } from '../../hooks/useElementInView';
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
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from '../common/CustomPropertyTable/CustomPropertyTable.interface';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
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
  followTopicHandler,
  unfollowTopicHandler,
  versionHandler,
  entityThread,
  isEntityThreadLoading,
  postFeedHandler,
  feedCount,
  entityFieldThreadCount,
  createThread,
  deletePostHandler,
  paging,
  fetchFeedHandler,
  updateThreadHandler,
  entityFieldTaskCount,
  onTopicUpdate,
}: TopicDetailsProps) => {
  const { t } = useTranslation();
  const { topicFQN, tab: activeTab = EntityTabs.SCHEMA } =
    useParams<{ topicFQN: string; tab: EntityTabs }>();
  const history = useHistory();
  const [isEdit, setIsEdit] = useState(false);
  const [threadLink, setThreadLink] = useState<string>('');
  const [elementRef, isInView] = useElementInView(observerOptions);
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const [activityFilter, setActivityFilter] = useState<ActivityFilters>();

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

  const breadcrumb = useMemo(
    () => getEntityBreadcrumbs(topicDetails, EntityType.TOPIC),
    [topicDetails]
  );

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

  const tabs = useMemo(() => {
    const allTabs = [
      {
        label: <TabsLabel id={EntityTabs.SCHEMA} name={t('label.schema')} />,
        key: EntityTabs.SCHEMA,
      },
      {
        label: (
          <TabsLabel
            count={feedCount}
            id={EntityTabs.ACTIVITY_FEED}
            isActive={activeTab === EntityTabs.ACTIVITY_FEED}
            name={t('label.activity-feed-and-task-plural')}
          />
        ),
        key: EntityTabs.ACTIVITY_FEED,
      },
      {
        label: (
          <TabsLabel
            id={EntityTabs.SAMPLE_DATA}
            name={t('label.sample-data')}
          />
        ),
        key: EntityTabs.SAMPLE_DATA,
      },
      {
        label: <TabsLabel id={EntityTabs.CONFIG} name={t('label.config')} />,
        key: EntityTabs.CONFIG,
      },
      {
        label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
        key: EntityTabs.LINEAGE,
      },
      {
        label: (
          <TabsLabel
            id={EntityTabs.CUSTOM_PROPERTIES}
            name={t('label.custom-property-plural')}
          />
        ),
        key: EntityTabs.CUSTOM_PROPERTIES,
      },
    ];

    return allTabs;
  }, [activeTab, feedCount]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(getTopicDetailsPath(topicFQN, activeKey));
    }
  };

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
        await onTopicUpdate(updatedTopicDetails, 'description');
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
      onTopicUpdate(updatedTopicDetails, 'owner');
    },
    [owner]
  );

  const onTierRemove = () => {
    if (topicDetails) {
      const updatedTopicDetails = {
        ...topicDetails,
        tags: getTagsWithoutTier(topicDetails.tags ?? []),
      };
      onTopicUpdate(updatedTopicDetails, 'tags');
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

      return onTopicUpdate(updatedTopicDetails, 'tags');
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
      onTopicUpdate(updatedTopic, 'tags');
    }
  };

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...topicDetails,
      displayName: data.displayName,
    };
    await onTopicUpdate(updatedData, 'displayName');
  };
  const onExtensionUpdate = async (updatedData: Topic) => {
    await onTopicUpdate(updatedData, 'extension');
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

  const loader = useMemo(
    () => (isEntityThreadLoading ? <Loader /> : null),
    [isEntityThreadLoading]
  );

  const fetchMoreThread = (
    isElementInView: boolean,
    pagingObj: Paging,
    isLoading: boolean
  ) => {
    if (
      isElementInView &&
      pagingObj?.after &&
      !isLoading &&
      activeTab === EntityTabs.ACTIVITY_FEED
    ) {
      fetchFeedHandler(
        pagingObj.after,
        activityFilter?.feedFilter,
        activityFilter?.threadType
      );
    }
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

  useEffect(() => {
    fetchMoreThread(isInView, paging, isEntityThreadLoading);
  }, [paging, isEntityThreadLoading, isInView]);

  const handleFeedFilterChange = useCallback((feedFilter, threadType) => {
    setActivityFilter({
      feedFilter,
      threadType,
    });
    fetchFeedHandler(undefined, feedFilter, threadType);
  }, []);

  const tabDetails = useMemo(() => {
    switch (activeTab) {
      case EntityTabs.CUSTOM_PROPERTIES:
        return (
          <CustomPropertyTable
            className="mt-0-important"
            entityDetails={topicDetails as CustomPropertyProps['entityDetails']}
            entityType={EntityType.TOPIC}
            handleExtensionUpdate={onExtensionUpdate}
            hasEditAccess={
              topicPermissions.EditAll || topicPermissions.EditCustomFields
            }
          />
        );
      case EntityTabs.LINEAGE:
        return (
          <Card
            className={classNames(ENTITY_CARD_CLASS, 'card-body-full')}
            data-testid="lineage-details">
            <EntityLineageComponent
              entityType={EntityType.TOPIC}
              hasEditAccess={
                topicPermissions.EditAll || topicPermissions.EditLineage
              }
            />
          </Card>
        );
      case EntityTabs.CONFIG:
        return (
          <Card
            className={classNames(ENTITY_CARD_CLASS, 'h-full')}
            data-testid="config-details">
            <SchemaEditor
              className="custom-code-mirror-theme"
              editorClass="table-query-editor"
              value={JSON.stringify(topicDetails.topicConfig)}
            />
          </Card>
        );
      case EntityTabs.SAMPLE_DATA:
        return <SampleDataTopic topicFQN={topicFQN} />;
      case EntityTabs.ACTIVITY_FEED:
        return (
          <Card className={ENTITY_CARD_CLASS}>
            <Row>
              <Col data-testid="activityfeed" offset={3} span={18}>
                <ActivityFeedList
                  isEntityFeed
                  withSidePanel
                  deletePostHandler={deletePostHandler}
                  entityName={entityName}
                  feedList={entityThread}
                  isFeedLoading={isEntityThreadLoading}
                  postFeedHandler={postFeedHandler}
                  updateThreadHandler={updateThreadHandler}
                  onFeedFiltersUpdate={handleFeedFilterChange}
                />
              </Col>
            </Row>
            {loader}
          </Card>
        );
      case EntityTabs.SCHEMA:
      default:
        return (
          <Card className={ENTITY_CARD_CLASS}>
            <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
              <div className="tw-col-span-full">
                <Description
                  description={topicDetails.description}
                  entityFieldTasks={getEntityFieldThreadCounts(
                    EntityField.DESCRIPTION,
                    entityFieldTaskCount
                  )}
                  entityFieldThreads={getEntityFieldThreadCounts(
                    EntityField.DESCRIPTION,
                    entityFieldThreadCount
                  )}
                  entityFqn={topicDetails.fullyQualifiedName}
                  entityName={entityName}
                  entityType={EntityType.TOPIC}
                  hasEditAccess={
                    topicPermissions.EditAll || topicPermissions.EditDescription
                  }
                  isEdit={isEdit}
                  isReadOnly={topicDetails.deleted}
                  owner={topicDetails.owner}
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
              isReadOnly={Boolean(topicDetails.deleted)}
              messageSchema={topicDetails.messageSchema}
              onUpdate={handleSchemaFieldsUpdate}
            />
          </Card>
        );
    }
  }, [
    activeTab,
    topicDetails,
    entityFieldTaskCount,
    entityFieldThreadCount,
    topicPermissions,
    isEdit,
    entityName,
    topicFQN,
    entityThread,
    isEntityThreadLoading,
  ]);

  return (
    <div className="entity-details-container">
      <EntityPageInfo
        canDelete={topicPermissions.Delete}
        currentOwner={topicDetails.owner}
        deleted={deleted}
        displayName={topicDetails.displayName}
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
        entityName={topicDetails.name}
        entityType={EntityType.TOPIC}
        extraInfo={extraInfo}
        followHandler={followTopic}
        followers={followersCount}
        followersList={followers}
        isFollowing={isFollowing}
        permission={topicPermissions}
        removeTier={
          topicPermissions.EditAll || topicPermissions.EditTier
            ? onTierRemove
            : undefined
        }
        serviceType={topicDetails.serviceType ?? ''}
        tags={topicTags}
        tagsHandler={onTagUpdate}
        tier={tier}
        titleLinks={breadcrumb}
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
        onUpdateDisplayName={handleUpdateDisplayName}
      />
      <div className="tw-mt-4 d-flex flex-col flex-grow">
        <Tabs
          activeKey={activeTab ?? EntityTabs.SCHEMA}
          data-testid="tabs"
          items={tabs}
          onChange={handleTabChange}
        />
        {tabDetails}
        <div
          data-testid="observer-element"
          id="observer-element"
          ref={elementRef as RefObject<HTMLDivElement>}
        />
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
  );
};

export default TopicDetails;
