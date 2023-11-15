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

import { FilterOutlined } from '@ant-design/icons';
import { Card, Col, Radio, Row, Space, Tabs, Typography } from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { groupBy, isEmpty, isUndefined, uniqBy } from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useParams } from 'react-router-dom';
import { ReactComponent as ExternalLinkIcon } from '../../assets/svg/external-links.svg';
import { useActivityFeedProvider } from '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../components/common/description/DescriptionV1';
import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import EntityLineageComponent from '../../components/Entity/EntityLineage/EntityLineage.component';
import ExecutionsTab from '../../components/Execution/Execution.component';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import { withActivityFeed } from '../../components/router/withActivityFeed';
import { ColumnFilter } from '../../components/Table/ColumnFilter/ColumnFilter.component';
import TableDescription from '../../components/TableDescription/TableDescription.component';
import TableTags from '../../components/TableTags/TableTags.component';
import TabsLabel from '../../components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../components/Tag/TagsViewer/TagsViewer.interface';
import TasksDAGView from '../../components/TasksDAGView/TasksDAGView';
import {
  getPipelineDetailsPath,
  NO_DATA_PLACEHOLDER,
  PRIMERY_COLOR,
} from '../../constants/constants';
import { PIPELINE_TASK_TABS } from '../../constants/pipeline.constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Tag } from '../../generated/entity/classification/tag';
import {
  Pipeline,
  PipelineStatus,
  TagLabel,
  Task,
} from '../../generated/entity/data/pipeline';
import { ThreadType } from '../../generated/entity/feed/thread';
import { TagSource } from '../../generated/type/schema';
import { postThread } from '../../rest/feedsAPI';
import { restorePipeline } from '../../rest/pipelineAPI';
import { getCurrentUserId, getFeedCounts } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import {
  getAllTags,
  searchTagInData,
} from '../../utils/TableTags/TableTags.utils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import { PipeLineDetailsProp } from './PipelineDetails.interface';

const PipelineDetails = ({
  updatePipelineDetailsState,
  pipelineDetails,
  fetchPipeline,
  descriptionUpdateHandler,
  followPipelineHandler,
  unFollowPipelineHandler,
  settingsUpdateHandler,
  taskUpdateHandler,
  versionHandler,
  pipelineFQN,
  onUpdateVote,
  onExtensionUpdate,
  handleToggleDelete,
}: PipeLineDetailsProp) => {
  const history = useHistory();
  const { tab } = useParams<{ tab: EntityTabs }>();
  const { t } = useTranslation();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const userID = getCurrentUserId();
  const {
    deleted,
    owner,
    description,
    pipelineStatus,
    entityName,
    tier,
    tags,
    followers,
  } = useMemo(() => {
    return {
      deleted: pipelineDetails.deleted,
      owner: pipelineDetails.owner,
      serviceType: pipelineDetails.serviceType,
      description: pipelineDetails.description,
      version: pipelineDetails.version,
      pipelineStatus: pipelineDetails.pipelineStatus,
      tier: getTierTags(pipelineDetails.tags ?? []),
      tags: getTagsWithoutTier(pipelineDetails.tags ?? []),
      entityName: getEntityName(pipelineDetails),
      followers: pipelineDetails.followers ?? [],
    };
  }, [pipelineDetails]);

  // local state variables

  const [isEdit, setIsEdit] = useState(false);

  const [editTask, setEditTask] = useState<{
    task: Task;
    index: number;
  }>();

  const [feedCount, setFeedCount] = useState<number>(0);

  const [threadLink, setThreadLink] = useState<string>('');

  const [selectedExecution] = useState<PipelineStatus | undefined>(
    pipelineStatus
  );
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );

  const [pipelinePermissions, setPipelinePermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const [activeTab, setActiveTab] = useState(PIPELINE_TASK_TABS.LIST_VIEW);

  const { getEntityPermission } = usePermissionProvider();

  const tasksInternal = useMemo(
    () =>
      pipelineDetails.tasks
        ? pipelineDetails.tasks.map((t) => ({ ...t, tags: t.tags ?? [] }))
        : [],
    [pipelineDetails.tasks]
  );

  const hasTagEditAccess = useMemo(
    () => pipelinePermissions.EditAll || pipelinePermissions.EditTags,
    [pipelinePermissions]
  );

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.PIPELINE, pipelineFQN, setFeedCount);

  const fetchResourcePermission = useCallback(async () => {
    try {
      const entityPermission = await getEntityPermission(
        ResourceEntity.PIPELINE,
        pipelineDetails.id
      );
      setPipelinePermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.asset-lowercase'),
        })
      );
    }
  }, [pipelineDetails.id, getEntityPermission, setPipelinePermissions]);

  useEffect(() => {
    if (pipelineDetails.id) {
      fetchResourcePermission();
    }
  }, [pipelineDetails.id]);

  const isFollowing = useMemo(
    () => followers.some(({ id }: { id: string }) => id === userID),
    [followers, userID]
  );

  const onTaskUpdate = async (taskDescription: string) => {
    if (editTask) {
      const updatedTasks = [...(pipelineDetails.tasks || [])];

      const updatedTask = {
        ...editTask.task,
        description: taskDescription,
      };
      updatedTasks[editTask.index] = updatedTask;

      const updatedPipeline = { ...pipelineDetails, tasks: updatedTasks };
      const jsonPatch = compare(pipelineDetails, updatedPipeline);
      await taskUpdateHandler(jsonPatch);
      setEditTask(undefined);
    } else {
      setEditTask(undefined);
    }
  };

  const closeEditTaskModal = (): void => {
    setEditTask(undefined);
  };

  const onOwnerUpdate = useCallback(
    async (newOwner?: Pipeline['owner']) => {
      const updatedPipelineDetails = {
        ...pipelineDetails,
        owner: newOwner ? { ...owner, ...newOwner } : undefined,
      };
      await settingsUpdateHandler(updatedPipelineDetails);
    },
    [owner]
  );

  const onTierUpdate = async (newTier?: Tag) => {
    const tierTag = updateTierTag(pipelineDetails?.tags ?? [], newTier);
    const updatedPipelineDetails = {
      ...pipelineDetails,
      tags: tierTag,
    };
    await settingsUpdateHandler(updatedPipelineDetails);
  };

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedPipelineDetails = {
      ...pipelineDetails,
      displayName: data.displayName,
    };
    await settingsUpdateHandler(updatedPipelineDetails);
  };

  const handleRestorePipeline = async () => {
    try {
      await restorePipeline(pipelineDetails.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.pipeline'),
        }),
        2000
      );
      handleToggleDelete();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.pipeline'),
        })
      );
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
      const updatedPipelineDetails = {
        ...pipelineDetails,
        description: updatedHTML,
      };
      await descriptionUpdateHandler(updatedPipelineDetails);
      setIsEdit(false);
    } else {
      setIsEdit(false);
    }
  };

  const followPipeline = useCallback(async () => {
    if (isFollowing) {
      await unFollowPipelineHandler(getEntityFeedCount);
    } else {
      await followPipelineHandler(getEntityFeedCount);
    }
  }, [isFollowing, followPipelineHandler, unFollowPipelineHandler]);

  const onThreadLinkSelect = (link: string, threadType?: ThreadType) => {
    setThreadLink(link);
    if (threadType) {
      setThreadType(threadType);
    }
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const handleTableTagSelection = async (
    selectedTags: EntityTags[],
    editColumnTag: Task
  ) => {
    const prevTags = editColumnTag.tags?.filter((tag) =>
      selectedTags.some((selectedTag) => selectedTag.tagFQN === tag.tagFQN)
    );

    const newTags = createTagObject(
      selectedTags.filter(
        (selectedTag) =>
          !editColumnTag.tags?.some((tag) => tag.tagFQN === selectedTag.tagFQN)
      )
    );

    const updatedTask = {
      ...editColumnTag,
      tags: [...(prevTags as TagLabel[]), ...newTags],
    } as Task;

    const updatedTasks: Task[] = [...(pipelineDetails.tasks ?? [])].map(
      (task) => (task.name === editColumnTag.name ? updatedTask : task)
    );

    const updatedPipeline = { ...pipelineDetails, tasks: updatedTasks };
    const jsonPatch = compare(pipelineDetails, updatedPipeline);

    await taskUpdateHandler(jsonPatch);
  };

  const tagFilter = useMemo(() => {
    const tags = getAllTags(tasksInternal);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [tasksInternal]);

  const taskColumns: ColumnsType<Task> = useMemo(
    () => [
      {
        key: t('label.name'),
        dataIndex: 'name',
        title: t('label.name'),
        width: 200,
        render: (_, record) =>
          isEmpty(record.sourceUrl) ? (
            <span>{getEntityName(record)}</span>
          ) : (
            <Link
              className="flex items-center gap-2"
              target="_blank"
              to={{ pathname: record.sourceUrl }}>
              <span>{getEntityName(record)}</span>
              <ExternalLinkIcon height={14} width={14} />
            </Link>
          ),
      },
      {
        key: t('label.type'),
        dataIndex: 'taskType',
        width: 180,
        title: t('label.type'),
        render: (text) => (
          <Typography.Text>{text || NO_DATA_PLACEHOLDER}</Typography.Text>
        ),
      },
      {
        key: t('label.description'),
        dataIndex: 'description',
        width: 350,
        title: t('label.description'),
        render: (_, record, index) => (
          <TableDescription
            columnData={{
              fqn: record.fullyQualifiedName ?? '',
              field: record.description,
            }}
            entityFqn={pipelineFQN}
            entityType={EntityType.PIPELINE}
            hasEditPermission={
              pipelinePermissions.EditDescription || pipelinePermissions.EditAll
            }
            index={index}
            isReadOnly={deleted}
            onClick={() => setEditTask({ task: record, index })}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 300,
        filterIcon: (filtered: boolean) => (
          <FilterOutlined
            data-testid="tag-filter"
            style={{ color: filtered ? PRIMERY_COLOR : undefined }}
          />
        ),
        render: (tags, record, index) => (
          <TableTags<Task>
            entityFqn={pipelineFQN}
            entityType={EntityType.PIPELINE}
            handleTagSelection={handleTableTagSelection}
            hasTagEditAccess={hasTagEditAccess}
            index={index}
            isReadOnly={deleted}
            record={record}
            tags={tags}
            type={TagSource.Classification}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        ),
        filters: tagFilter.Classification,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'glossary',
        accessor: 'tags',
        width: 300,
        filterIcon: (filtered: boolean) => (
          <FilterOutlined
            data-testid="glossary-filter"
            style={{ color: filtered ? PRIMERY_COLOR : undefined }}
          />
        ),
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
        render: (tags, record, index) => (
          <TableTags<Task>
            entityFqn={pipelineFQN}
            entityType={EntityType.PIPELINE}
            handleTagSelection={handleTableTagSelection}
            hasTagEditAccess={hasTagEditAccess}
            index={index}
            isReadOnly={deleted}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        ),
      },
    ],
    [
      deleted,
      editTask,
      hasTagEditAccess,
      pipelinePermissions,
      getEntityName,
      onThreadLinkSelect,
      handleTableTagSelection,
      getEntityFieldThreadCounts,
    ]
  );

  const handleTabChange = (tabValue: string) => {
    if (tabValue !== tab) {
      history.push({
        pathname: getPipelineDetailsPath(pipelineFQN, tabValue),
      });
    }
  };

  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && pipelineDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTopic = { ...pipelineDetails, tags: updatedTags };
      await settingsUpdateHandler(updatedTopic);
    }
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) =>
      isSoftDelete ? handleToggleDelete : history.push('/'),
    []
  );

  const tabs = useMemo(
    () => [
      {
        label: (
          <TabsLabel id={EntityTabs.TASKS} name={t('label.task-plural')} />
        ),
        key: EntityTabs.TASKS,
        children: (
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <DescriptionV1
                    description={description}
                    entityFqn={pipelineFQN}
                    entityName={entityName}
                    entityType={EntityType.PIPELINE}
                    hasEditAccess={
                      pipelinePermissions.EditAll ||
                      pipelinePermissions.EditDescription
                    }
                    isEdit={isEdit}
                    isReadOnly={deleted}
                    owner={owner}
                    onCancel={onCancel}
                    onDescriptionEdit={onDescriptionEdit}
                    onDescriptionUpdate={onDescriptionUpdate}
                    onThreadLinkSelect={onThreadLinkSelect}
                  />
                </Col>
                <Col span={24}>
                  <Radio.Group
                    buttonStyle="solid"
                    className="radio-switch"
                    data-testid="pipeline-task-switch"
                    optionType="button"
                    options={Object.values(PIPELINE_TASK_TABS)}
                    value={activeTab}
                    onChange={(e) => setActiveTab(e.target.value)}
                  />
                </Col>
                <Col span={24}>
                  {activeTab === PIPELINE_TASK_TABS.LIST_VIEW ? (
                    <Table
                      bordered
                      columns={taskColumns}
                      data-testid="task-table"
                      dataSource={tasksInternal}
                      pagination={false}
                      rowKey="name"
                      scroll={{ x: 1200 }}
                      size="small"
                    />
                  ) : !isEmpty(pipelineDetails.tasks) &&
                    !isUndefined(pipelineDetails.tasks) ? (
                    <Card
                      headStyle={{ background: '#fafafa' }}
                      title={t('label.dag-view')}>
                      <div className="h-100">
                        <TasksDAGView
                          selectedExec={selectedExecution}
                          tasks={pipelineDetails.tasks}
                        />
                      </div>
                    </Card>
                  ) : (
                    <Card className="text-center" data-testid="no-tasks-data">
                      <span>{t('server.no-task-available')}</span>
                    </Card>
                  )}
                </Col>
              </Row>
            </Col>
            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="320px">
              <Space className="w-full" direction="vertical" size="large">
                <TagsContainerV2
                  displayType={DisplayType.READ_MORE}
                  entityFqn={pipelineFQN}
                  entityType={EntityType.PIPELINE}
                  permission={
                    (pipelinePermissions.EditAll ||
                      pipelinePermissions.EditTags) &&
                    !pipelineDetails.deleted
                  }
                  selectedTags={tags}
                  tagType={TagSource.Classification}
                  onSelectionChange={handleTagSelection}
                  onThreadLinkSelect={onThreadLinkSelect}
                />

                <TagsContainerV2
                  displayType={DisplayType.READ_MORE}
                  entityFqn={pipelineFQN}
                  entityType={EntityType.PIPELINE}
                  permission={
                    (pipelinePermissions.EditAll ||
                      pipelinePermissions.EditTags) &&
                    !pipelineDetails.deleted
                  }
                  selectedTags={tags}
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
            isActive={tab === EntityTabs.ACTIVITY_FEED}
            name={t('label.activity-feed-and-task-plural')}
          />
        ),
        key: EntityTabs.ACTIVITY_FEED,
        children: (
          <ActivityFeedTab
            entityType={EntityType.PIPELINE}
            fqn={pipelineDetails?.fullyQualifiedName ?? ''}
            onFeedUpdate={getEntityFeedCount}
            onUpdateEntityDetails={fetchPipeline}
          />
        ),
      },
      {
        label: (
          <TabsLabel
            id={EntityTabs.EXECUTIONS}
            name={t('label.execution-plural')}
          />
        ),
        key: EntityTabs.EXECUTIONS,
        children: (
          <ExecutionsTab
            pipelineFQN={pipelineFQN}
            tasks={pipelineDetails.tasks ?? []}
          />
        ),
      },
      {
        label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
        key: EntityTabs.LINEAGE,
        children: (
          <EntityLineageComponent
            deleted={deleted}
            entity={pipelineDetails}
            entityType={EntityType.PIPELINE}
            hasEditAccess={
              pipelinePermissions.EditAll || pipelinePermissions.EditLineage
            }
          />
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
            entityType={EntityType.PIPELINE}
            handleExtensionUpdate={onExtensionUpdate}
            hasEditAccess={
              pipelinePermissions.EditAll ||
              pipelinePermissions.EditCustomFields
            }
            hasPermission={pipelinePermissions.ViewAll}
          />
        ),
      },
    ],
    [
      description,
      activeTab,
      feedCount,
      isEdit,
      deleted,
      owner,
      entityName,
      pipelineFQN,
      pipelineDetails,
      selectedExecution,
      taskColumns,
      tasksInternal,
      pipelinePermissions,
      handleTagSelection,
      onExtensionUpdate,
      getEntityFieldThreadCounts,
      onCancel,
      onDescriptionEdit,
      onDescriptionUpdate,
      onThreadLinkSelect,
    ]
  );

  useEffect(() => {
    getEntityFeedCount();
  }, [pipelineFQN, description, pipelineDetails]);

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle="Table details"
      title="Table details">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updatePipelineDetailsState}
            dataAsset={pipelineDetails}
            entityType={EntityType.PIPELINE}
            permissions={pipelinePermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followPipeline}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestorePipeline}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>

        <Col span={24}>
          <Tabs
            activeKey={tab ?? EntityTabs.TASKS}
            className="entity-details-page-tabs"
            data-testid="tabs"
            items={tabs}
            onChange={handleTabChange}
          />
        </Col>
      </Row>

      {editTask && (
        <ModalWithMarkdownEditor
          header={`${t('label.edit-entity', { entity: t('label.task') })}: "${
            editTask.task.displayName || editTask.task.name
          }"`}
          placeholder={t('label.enter-field-description', {
            field: t('label.task-lowercase'),
          })}
          value={editTask.task.description || ''}
          visible={Boolean(editTask)}
          onCancel={closeEditTaskModal}
          onSave={onTaskUpdate}
        />
      )}

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

export default withActivityFeed<PipeLineDetailsProp>(PipelineDetails);
