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

import { Card, Col, Row, Space, Tabs } from 'antd';
import { AxiosError } from 'axios';
import ActivityFeedProvider, {
  useActivityFeedProvider,
} from 'components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from 'components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { DataAssetsHeader } from 'components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsContainerV1 from 'components/Tag/TagsContainerV1/TagsContainerV1';
import { getTopicDetailsPath } from 'constants/constants';
import { TagLabel } from 'generated/type/schema';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { restoreTopic } from 'rest/topicsAPI';
import { getEntityName, getEntityThreadLink } from 'utils/EntityUtils';
import { EntityField } from '../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Topic } from '../../generated/entity/data/topic';
import { ThreadType } from '../../generated/entity/feed/thread';
import { LabelType, State, TagSource } from '../../generated/type/tagLabel';
import { getCurrentUserId, refreshPage } from '../../utils/CommonUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from '../common/CustomPropertyTable/CustomPropertyTable.interface';
import EntityLineageComponent from '../EntityLineage/EntityLineage.component';
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
  unFollowTopicHandler,
  versionHandler,
  feedCount,
  entityFieldThreadCount,
  createThread,
  entityFieldTaskCount,
  onTopicUpdate,
}: TopicDetailsProps) => {
  const { t } = useTranslation();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { topicFQN, tab: activeTab = EntityTabs.SCHEMA } =
    useParams<{ topicFQN: string; tab: EntityTabs }>();
  const history = useHistory();
  const [isEdit, setIsEdit] = useState(false);
  const [threadLink, setThreadLink] = useState<string>('');

  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );

  const [topicPermissions, setTopicPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const { getEntityPermission } = usePermissionProvider();
  const {
    owner,
    description,
    followers = [],
    entityName,
    topicTags,
    tier,
  } = useMemo(() => {
    return {
      ...topicDetails,
      tier: getTierTags(topicDetails.tags ?? []),
      topicTags: getTagsWithoutTier(topicDetails.tags ?? []),
      entityName: getEntityName(topicDetails),
    };
  }, [topicDetails]);

  const { isFollowing } = useMemo(() => {
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

  const followTopic = async () => {
    isFollowing ? await unFollowTopicHandler() : await followTopicHandler();
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

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(getTopicDetailsPath(topicFQN, activeKey));
    }
  };

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
    async (newOwner?: Topic['owner']) => {
      const updatedTopicDetails = {
        ...topicDetails,
        owner: newOwner
          ? {
              ...owner,
              ...newOwner,
            }
          : undefined,
      };
      await onTopicUpdate(updatedTopicDetails, 'owner');
    },
    [owner]
  );

  const onTierUpdate = (newTier?: string) => {
    const tierTag: Topic['tags'] = newTier
      ? [
          ...getTagsWithoutTier(topicDetails.tags as Array<EntityTags>),
          {
            tagFQN: newTier,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ]
      : getTagsWithoutTier(topicDetails.tags ?? []);
    const updatedTopicDetails = {
      ...topicDetails,
      tags: tierTag,
    };

    return onTopicUpdate(updatedTopicDetails, 'tags');
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = selectedTags?.map((tag) => ({
      source: tag.source,
      tagFQN: tag.tagFQN,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    }));

    if (updatedTags && topicDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTopic = { ...topicDetails, tags: updatedTags };
      await onTopicUpdate(updatedTopic, 'tags');
    }
  };

  const tabs = useMemo(
    () => [
      {
        label: <TabsLabel id={EntityTabs.SCHEMA} name={t('label.schema')} />,
        key: EntityTabs.SCHEMA,
        children: (
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-l-lg" flex="auto">
              <div className="d-flex flex-col gap-4">
                <DescriptionV1
                  description={topicDetails.description}
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
              </div>
            </Col>
            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="320px">
              <Space className="w-full" direction="vertical" size="large">
                <TagsContainerV1
                  entityFqn={topicDetails.fullyQualifiedName}
                  entityThreadLink={getEntityThreadLink(entityFieldThreadCount)}
                  entityType={EntityType.TOPIC}
                  permission={
                    topicPermissions.EditAll || topicPermissions.EditTags
                  }
                  selectedTags={topicTags}
                  tagType={TagSource.Classification}
                  onSelectionChange={handleTagSelection}
                  onThreadLinkSelect={onThreadLinkSelect}
                />

                <TagsContainerV1
                  entityFqn={topicDetails.fullyQualifiedName}
                  entityThreadLink={getEntityThreadLink(entityFieldThreadCount)}
                  entityType={EntityType.TOPIC}
                  permission={
                    topicPermissions.EditAll || topicPermissions.EditTags
                  }
                  selectedTags={topicTags}
                  tagType={TagSource.Glossary}
                  onSelectionChange={handleTagSelection}
                  onThreadLinkSelect={onThreadLinkSelect}
                />
              </Space>
            </Col>
          </Row>
        ),
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
        children: (
          <ActivityFeedProvider>
            <ActivityFeedTab
              entityType={EntityType.TOPIC}
              fqn={topicDetails?.fullyQualifiedName ?? ''}
              onFeedUpdate={() => Promise.resolve()}
            />
          </ActivityFeedProvider>
        ),
      },
      {
        label: (
          <TabsLabel
            id={EntityTabs.SAMPLE_DATA}
            name={t('label.sample-data')}
          />
        ),
        key: EntityTabs.SAMPLE_DATA,
        children: <SampleDataTopic topicFQN={topicFQN} />,
      },
      {
        label: <TabsLabel id={EntityTabs.CONFIG} name={t('label.config')} />,
        key: EntityTabs.CONFIG,
        children: (
          <Card className="m-md w-auto" data-testid="config-details">
            <SchemaEditor
              className="custom-code-mirror-theme"
              editorClass="table-query-editor"
              value={JSON.stringify(topicDetails.topicConfig)}
            />
          </Card>
        ),
      },
      {
        label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
        key: EntityTabs.LINEAGE,
        children: (
          <Card
            className="lineage-card card-body-full w-auto border-none"
            data-testid="lineage-details"
            id="lineageDetails">
            <EntityLineageComponent
              entityType={EntityType.TOPIC}
              hasEditAccess={
                topicPermissions.EditAll || topicPermissions.EditLineage
              }
            />
          </Card>
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
        children: (
          <CustomPropertyTable
            entityDetails={topicDetails as CustomPropertyProps['entityDetails']}
            entityType={EntityType.TOPIC}
            handleExtensionUpdate={onExtensionUpdate}
            hasEditAccess={
              topicPermissions.EditAll || topicPermissions.EditCustomFields
            }
          />
        ),
      },
    ],
    [
      activeTab,
      feedCount,
      topicDetails,
      entityFieldTaskCount,
      entityFieldThreadCount,
      topicPermissions,
      isEdit,
      entityName,
      topicFQN,
    ]
  );

  useEffect(() => {
    if (topicDetails.id) {
      fetchResourcePermission();
    }
  }, [topicDetails.id]);

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle="Table details"
      title="Table details">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            dataAsset={topicDetails}
            entityType={EntityType.TOPIC}
            permissions={topicPermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followTopic}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreTopic}
            onTierUpdate={onTierUpdate}
            onVersionClick={versionHandler}
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

      {threadLink ? (
        <ActivityThreadPanel
          createThread={createThread}
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

export default TopicDetails;
