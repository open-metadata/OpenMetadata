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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Card, Col, Radio, Row, Tabs, Typography } from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { groupBy, isEmpty, isUndefined, uniqBy } from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useParams } from 'react-router-dom';
import { ReactComponent as ExternalLinkIcon } from '../../../assets/svg/external-links.svg';
import {
  DATA_ASSET_ICON_DIMENSION,
  getEntityDetailsPath,
  NO_DATA_PLACEHOLDER,
} from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { PIPELINE_TASK_TABS } from '../../../constants/pipeline.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../../constants/ResizablePanel.constants';
import LineageProvider from '../../../context/LineageProvider/LineageProvider';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { CreateThread } from '../../../generated/api/feed/createThread';
import { Tag } from '../../../generated/entity/classification/tag';
import {
  Pipeline,
  PipelineStatus,
  TagLabel,
  Task,
} from '../../../generated/entity/data/pipeline';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { TagSource } from '../../../generated/type/schema';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { FeedCounts } from '../../../interface/feed.interface';
import { postThread } from '../../../rest/feedsAPI';
import { restorePipeline } from '../../../rest/pipelineAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import { getColumnSorter, getEntityName } from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import {
  getAllTags,
  searchTagInData,
} from '../../../utils/TableTags/TableTags.utils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useActivityFeedProvider } from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import ActivityThreadPanel from '../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { withActivityFeed } from '../../AppRouter/withActivityFeed';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { DataAssetsHeader } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { ColumnFilter } from '../../Database/ColumnFilter/ColumnFilter.component';
import TableDescription from '../../Database/TableDescription/TableDescription.component';
import TableTags from '../../Database/TableTags/TableTags.component';
import EntityRightPanel from '../../Entity/EntityRightPanel/EntityRightPanel';
import Lineage from '../../Lineage/Lineage.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import ExecutionsTab from '../Execution/Execution.component';
import TasksDAGView from '../TasksDAGView/TasksDAGView';
import './pipeline-details.style.less';
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
  const { currentUser, theme } = useApplicationStore();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const userID = currentUser?.id ?? '';
  const {
    deleted,
    owners,
    description,
    pipelineStatus,
    entityName,
    tier,
    tags,
    followers,
  } = useMemo(() => {
    return {
      deleted: pipelineDetails.deleted,
      owners: pipelineDetails.owners,
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

  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

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

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.PIPELINE, pipelineFQN, handleFeedCount);

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
      const updatedTasks = [...(pipelineDetails.tasks ?? [])];

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
    async (newOwners?: Pipeline['owners']) => {
      const updatedPipelineDetails = {
        ...pipelineDetails,
        owners: newOwners,
      };
      await settingsUpdateHandler(updatedPipelineDetails);
    },
    [owners]
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
      const { version: newVersion } = await restorePipeline(pipelineDetails.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.pipeline'),
        }),
        2000
      );
      handleToggleDelete(newVersion);
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
      await unFollowPipelineHandler();
    } else {
      await followPipelineHandler();
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

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editLineagePermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (pipelinePermissions.EditTags || pipelinePermissions.EditAll) &&
        !deleted,
      editGlossaryTermsPermission:
        (pipelinePermissions.EditGlossaryTerms ||
          pipelinePermissions.EditAll) &&
        !deleted,
      editDescriptionPermission:
        (pipelinePermissions.EditDescription || pipelinePermissions.EditAll) &&
        !deleted,
      editCustomAttributePermission:
        (pipelinePermissions.EditAll || pipelinePermissions.EditCustomFields) &&
        !deleted,
      editLineagePermission:
        (pipelinePermissions.EditAll || pipelinePermissions.EditLineage) &&
        !deleted,
      viewAllPermission: pipelinePermissions.ViewAll,
    }),
    [pipelinePermissions, deleted]
  );

  const taskColumns: ColumnsType<Task> = useMemo(
    () => [
      {
        key: t('label.name'),
        dataIndex: 'name',
        title: t('label.name'),
        width: 220,
        fixed: 'left',
        sorter: getColumnSorter<Task, 'name'>('name'),
        render: (_, record) =>
          isEmpty(record.sourceUrl) ? (
            <span>{getEntityName(record)}</span>
          ) : (
            <Link
              className="flex items-center gap-2"
              target="_blank"
              to={{ pathname: record.sourceUrl }}>
              <div className="d-flex items-center">
                <span className="break-all">{getEntityName(record)}</span>

                <Icon
                  className="m-l-xs flex-none"
                  component={ExternalLinkIcon}
                  style={DATA_ASSET_ICON_DIMENSION}
                />
              </div>
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
            hasEditPermission={editDescriptionPermission}
            index={index}
            isReadOnly={deleted}
            onClick={() => setEditTask({ task: record, index })}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        ),
      },
      {
        title: t('label.owner-plural'),
        dataIndex: 'owners',
        key: 'owners',
        width: 120,
        accessor: 'owner',
        filterIcon: (filtered) => (
          <FilterOutlined
            data-testid="tag-filter"
            style={{
              color: filtered ? theme.primaryColor : undefined,
            }}
          />
        ),
        render: (owner) => <OwnerLabel hasPermission={false} owners={owner} />,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 300,
        filterIcon: (filtered) => (
          <FilterOutlined
            data-testid="tag-filter"
            style={{
              color: filtered ? theme.primaryColor : undefined,
            }}
          />
        ),
        render: (tags, record, index) => (
          <TableTags<Task>
            entityFqn={pipelineFQN}
            entityType={EntityType.PIPELINE}
            handleTagSelection={handleTableTagSelection}
            hasTagEditAccess={editTagsPermission}
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
        filterIcon: (filtered) => (
          <FilterOutlined
            data-testid="glossary-filter"
            style={{
              color: filtered ? theme.primaryColor : undefined,
            }}
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
            hasTagEditAccess={editGlossaryTermsPermission}
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
      editTagsPermission,
      editGlossaryTermsPermission,
      getEntityName,
      onThreadLinkSelect,
      handleTableTagSelection,
      editDescriptionPermission,
    ]
  );

  const handleTabChange = (tabValue: string) => {
    if (tabValue !== tab) {
      history.push({
        pathname: getEntityDetailsPath(
          EntityType.PIPELINE,
          pipelineFQN,
          tabValue
        ),
      });
    }
  };

  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
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
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? handleToggleDelete(version) : history.push('/'),
    []
  );

  const tasksDAGView = useMemo(
    () =>
      !isEmpty(pipelineDetails.tasks) && !isUndefined(pipelineDetails.tasks) ? (
        <Card className="task-dag-view-card" title={t('label.dag-view')}>
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
      ),
    [pipelineDetails, selectedExecution]
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
            <Col className="tab-content-height-with-resizable-panel" span={24}>
              <ResizablePanels
                firstPanel={{
                  className: 'entity-resizable-panel-container',
                  children: (
                    <div className="p-t-sm m-x-lg">
                      <Row gutter={[0, 16]}>
                        <Col span={24}>
                          <DescriptionV1
                            description={description}
                            entityFqn={pipelineFQN}
                            entityName={entityName}
                            entityType={EntityType.PIPELINE}
                            hasEditAccess={editDescriptionPermission}
                            isDescriptionExpanded={isEmpty(tasksInternal)}
                            isEdit={isEdit}
                            owner={owners}
                            showActions={!deleted}
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
                              className="align-table-filter-left"
                              columns={taskColumns}
                              data-testid="task-table"
                              dataSource={tasksInternal}
                              pagination={false}
                              rowKey="name"
                              scroll={{ x: 1200 }}
                              size="small"
                            />
                          ) : (
                            tasksDAGView
                          )}
                        </Col>
                      </Row>
                    </div>
                  ),
                  ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
                }}
                secondPanel={{
                  children: (
                    <div data-testid="entity-right-panel">
                      <EntityRightPanel<EntityType.PIPELINE>
                        customProperties={pipelineDetails}
                        dataProducts={pipelineDetails?.dataProducts ?? []}
                        domain={pipelineDetails?.domain}
                        editCustomAttributePermission={
                          editCustomAttributePermission
                        }
                        editGlossaryTermsPermission={
                          editGlossaryTermsPermission
                        }
                        editTagPermission={editTagsPermission}
                        entityFQN={pipelineFQN}
                        entityId={pipelineDetails.id}
                        entityType={EntityType.PIPELINE}
                        selectedTags={tags}
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
            isActive={tab === EntityTabs.ACTIVITY_FEED}
            name={t('label.activity-feed-and-task-plural')}
          />
        ),
        key: EntityTabs.ACTIVITY_FEED,
        children: (
          <ActivityFeedTab
            refetchFeed
            entityFeedTotalCount={feedCount.totalCount}
            entityType={EntityType.PIPELINE}
            fqn={pipelineDetails?.fullyQualifiedName ?? ''}
            onFeedUpdate={getEntityFeedCount}
            onUpdateEntityDetails={fetchPipeline}
            onUpdateFeedCount={handleFeedCount}
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
          <LineageProvider>
            <Lineage
              deleted={deleted}
              entity={pipelineDetails as SourceType}
              entityType={EntityType.PIPELINE}
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
        children: pipelineDetails && (
          <div className="m-sm">
            <CustomPropertyTable<EntityType.PIPELINE>
              entityDetails={pipelineDetails}
              entityType={EntityType.PIPELINE}
              handleExtensionUpdate={onExtensionUpdate}
              hasEditAccess={editCustomAttributePermission}
              hasPermission={viewAllPermission}
            />
          </div>
        ),
      },
    ],
    [
      description,
      activeTab,
      feedCount.totalCount,
      isEdit,
      deleted,
      owners,
      entityName,
      pipelineFQN,
      pipelineDetails,
      tasksDAGView,
      taskColumns,
      tasksInternal,
      handleFeedCount,
      handleTagSelection,
      onExtensionUpdate,
      onCancel,
      onDescriptionEdit,
      onDescriptionUpdate,
      onThreadLinkSelect,
      editDescriptionPermission,
      editTagsPermission,
      editGlossaryTermsPermission,
      editLineagePermission,
      editCustomAttributePermission,
      viewAllPermission,
    ]
  );

  useEffect(() => {
    getEntityFeedCount();
  }, [pipelineFQN]);

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.pipeline'),
      })}>
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updatePipelineDetailsState}
            dataAsset={pipelineDetails}
            entityType={EntityType.PIPELINE}
            openTaskCount={feedCount.openTaskCount}
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
          header={`${t('label.edit-entity', {
            entity: t('label.task'),
          })}: "${getEntityName(editTask.task)}"`}
          placeholder={t('label.enter-field-description', {
            field: t('label.task-lowercase'),
          })}
          value={editTask.task.description ?? ''}
          visible={Boolean(editTask)}
          onCancel={closeEditTaskModal}
          onSave={onTaskUpdate}
        />
      )}

      <LimitWrapper resource="pipeline">
        <></>
      </LimitWrapper>

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
