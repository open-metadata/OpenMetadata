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

import { Card, Col, Row, Space, Table, Tabs, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { AxiosError } from 'axios';
import ActivityFeedProvider, {
  useActivityFeedProvider,
} from 'components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from 'components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { DataAssetsHeader } from 'components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import TableTags from 'components/TableTags/TableTags.component';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsContainerV1 from 'components/Tag/TagsContainerV1/TagsContainerV1';
import { getDashboardDetailsPath } from 'constants/constants';
import { compare } from 'fast-json-patch';
import { TagSource } from 'generated/type/schema';
import { isEmpty, isUndefined, map } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { restoreDashboard } from 'rest/dashboardAPI';
import { getEntityName } from 'utils/EntityUtils';
import { getFilterTags } from 'utils/TableTags/TableTags.utils';
import { ReactComponent as ExternalLinkIcon } from '../../assets/svg/external-links.svg';
import { EntityField } from '../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { ThreadType } from '../../generated/entity/feed/thread';
import { LabelType, State, TagLabel } from '../../generated/type/tagLabel';
import { getCurrentUserId, refreshPage } from '../../utils/CommonUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import {
  fetchGlossaryTerms,
  getGlossaryTermlist,
} from '../../utils/GlossaryUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { getClassifications, getTaglist } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from '../common/CustomPropertyTable/CustomPropertyTable.interface';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import EntityLineageComponent from '../EntityLineage/EntityLineage.component';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import {
  ChartsPermissions,
  ChartType,
  DashboardDetailsProps,
} from './DashboardDetails.interface';

const DashboardDetails = ({
  followDashboardHandler,
  unFollowDashboardHandler,
  dashboardDetails,
  charts,
  chartDescriptionUpdateHandler,
  chartTagUpdateHandler,
  versionHandler,
  feedCount,
  entityFieldThreadCount,
  createThread,
  entityFieldTaskCount,
  onDashboardUpdate,
}: DashboardDetailsProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { dashboardFQN, tab: activeTab = EntityTabs.DETAILS } =
    useParams<{ dashboardFQN: string; tab: EntityTabs }>();

  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const [isEdit, setIsEdit] = useState(false);
  const [editChart, setEditChart] = useState<{
    chart: ChartType;
    index: number;
  }>();

  const [tagFetchFailed, setTagFetchFailed] = useState<boolean>(false);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [isGlossaryLoading, setIsGlossaryLoading] = useState<boolean>(false);

  const [threadLink, setThreadLink] = useState<string>('');

  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const [dashboardPermissions, setDashboardPermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );
  const [chartsPermissionsArray, setChartsPermissionsArray] = useState<
    Array<ChartsPermissions>
  >([]);

  const [glossaryTags, setGlossaryTags] = useState<TagOption[]>([]);
  const [classificationTags, setClassificationTags] = useState<TagOption[]>([]);

  const {
    owner,
    description,
    entityName,
    followers = [],
    deleted,
    dashboardTags,
    tier,
  } = useMemo(() => {
    const { tags = [] } = dashboardDetails;

    return {
      ...dashboardDetails,
      tier: getTierTags(tags),
      dashboardTags: getTagsWithoutTier(tags),
      entityName: getEntityName(dashboardDetails),
    };
  }, [dashboardDetails]);

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === getCurrentUserId()),
    };
  }, [followers]);

  const { getEntityPermission } = usePermissionProvider();

  const fetchResourcePermission = useCallback(async () => {
    try {
      const entityPermission = await getEntityPermission(
        ResourceEntity.DASHBOARD,
        dashboardDetails.id
      );
      setDashboardPermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.dashboard'),
        })
      );
    }
  }, [dashboardDetails.id, getEntityPermission, setDashboardPermissions]);

  useEffect(() => {
    if (dashboardDetails.id) {
      fetchResourcePermission();
    }
  }, [dashboardDetails.id]);

  const fetchChartPermissions = useCallback(async (id: string) => {
    try {
      const chartPermission = await getEntityPermission(
        ResourceEntity.CHART,
        id
      );

      return chartPermission;
    } catch (error) {
      return DEFAULT_ENTITY_PERMISSION;
    }
  }, []);

  const getAllChartsPermissions = useCallback(
    async (charts: ChartType[]) => {
      const permissionsArray: Array<ChartsPermissions> = [];
      try {
        await Promise.all(
          charts.map(async (chart) => {
            const chartPermissions = await fetchChartPermissions(chart.id);
            permissionsArray.push({
              id: chart.id,
              permissions: chartPermissions,
            });
          })
        );

        setChartsPermissionsArray(permissionsArray);
      } catch {
        showErrorToast(
          t('server.fetch-entity-permissions-error', {
            entity: t('label.chart'),
          })
        );
      }
    },
    [dashboardDetails]
  );

  const fetchGlossaryTags = async () => {
    setIsGlossaryLoading(true);
    try {
      const res = await fetchGlossaryTerms();

      const glossaryTerms: TagOption[] = getGlossaryTermlist(res).map(
        (tag) => ({ fqn: tag, source: TagSource.Glossary })
      );
      setGlossaryTags(glossaryTerms);
    } catch {
      setTagFetchFailed(true);
    } finally {
      setIsGlossaryLoading(false);
    }
  };

  const fetchClassificationTags = async () => {
    setIsTagLoading(true);
    try {
      const res = await getClassifications();
      const tagList = await getTaglist(res.data);

      const classificationTag: TagOption[] = map(tagList, (tag) => ({
        fqn: tag,
        source: TagSource.Classification,
      }));

      setClassificationTags(classificationTag);
    } catch {
      setTagFetchFailed(true);
    } finally {
      setIsTagLoading(false);
    }
  };

  useEffect(() => {
    if (charts) {
      getAllChartsPermissions(charts);
    }
  }, [charts]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(getDashboardDetailsPath(dashboardFQN, activeKey));
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
      const updatedDashboard = {
        ...dashboardDetails,
        description: updatedHTML,
      };
      try {
        await onDashboardUpdate(updatedDashboard, 'description');
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
    async (newOwner?: Dashboard['owner']) => {
      const updatedDashboard = {
        ...dashboardDetails,
        owner: newOwner ? { ...owner, ...newOwner } : undefined,
      };
      await onDashboardUpdate(updatedDashboard, 'owner');
    },
    [owner]
  );

  const onTierUpdate = async (newTier?: string) => {
    const tierTag: Dashboard['tags'] = newTier
      ? [
          ...getTagsWithoutTier(dashboardDetails.tags as Array<EntityTags>),
          {
            tagFQN: newTier,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ]
      : getTagsWithoutTier(dashboardDetails.tags ?? []);
    const updatedDashboard = {
      ...dashboardDetails,
      tags: tierTag,
    };
    await onDashboardUpdate(updatedDashboard, 'tags');
  };

  const onUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...dashboardDetails,
      displayName: data.displayName,
    };
    await onDashboardUpdate(updatedData, 'displayName');
  };
  const onExtensionUpdate = async (updatedData: Dashboard) => {
    await onDashboardUpdate(updatedData, 'extension');
  };

  const handleRestoreDashboard = async () => {
    try {
      await restoreDashboard(dashboardDetails.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.dashboard'),
        }),
        2000
      );
      refreshPage();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.dashboard'),
        })
      );
    }
  };

  const followDashboard = async () => {
    isFollowing
      ? await unFollowDashboardHandler()
      : await followDashboardHandler();
  };
  const handleUpdateChart = (chart: ChartType, index: number) => {
    setEditChart({ chart, index });
  };

  const closeEditChartModal = (): void => {
    setEditChart(undefined);
  };
  const onChartUpdate = async (chartDescription: string) => {
    if (editChart) {
      const updatedChart = {
        ...editChart.chart,
        description: chartDescription,
      };
      const jsonPatch = compare(charts[editChart.index], updatedChart);

      try {
        await chartDescriptionUpdateHandler(
          editChart.index,
          editChart.chart.id,
          jsonPatch
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setEditChart(undefined);
      }
    } else {
      setEditChart(undefined);
    }
  };

  const handleChartTagSelection = async (
    selectedTags: Array<EntityTags>,
    editColumnTag: ChartType,
    otherTags: TagLabel[]
  ) => {
    if (selectedTags && editColumnTag) {
      const newSelectedTags: TagOption[] = map(
        [...selectedTags, ...otherTags],
        (tag) => ({ fqn: tag.tagFQN, source: tag.source })
      );

      const prevTags = editColumnTag.tags?.filter((tag) =>
        newSelectedTags.some((selectedTag) => selectedTag.fqn === tag.tagFQN)
      );
      const newTags = newSelectedTags
        .filter(
          (selectedTag) =>
            !editColumnTag.tags?.some((tag) => tag.tagFQN === selectedTag.fqn)
        )
        .map((tag) => ({
          labelType: 'Manual',
          state: 'Confirmed',
          source: tag.source,
          tagFQN: tag.fqn,
        }));

      const updatedChart = {
        ...editColumnTag,
        tags: [...(prevTags as TagLabel[]), ...newTags],
      };
      const jsonPatch = compare(editColumnTag, updatedChart);
      await chartTagUpdateHandler(editColumnTag.id, jsonPatch);
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

  const renderDescription = useCallback(
    (text, record, index) => {
      const permissionsObject = chartsPermissionsArray?.find(
        (chart) => chart.id === record.id
      )?.permissions;

      const editDescriptionPermissions =
        !isUndefined(permissionsObject) &&
        (permissionsObject.EditDescription || permissionsObject.EditAll);

      return (
        <Space
          className="w-full tw-group cursor-pointer"
          data-testid="description">
          <div>
            {text ? (
              <RichTextEditorPreviewer markdown={text} />
            ) : (
              <span className="text-grey-muted">
                {t('label.no-entity', {
                  entity: t('label.description'),
                })}
              </span>
            )}
          </div>
          {!deleted && (
            <Tooltip
              title={
                editDescriptionPermissions
                  ? t('label.edit-entity', {
                      entity: t('label.description'),
                    })
                  : t('message.no-permission-for-action')
              }>
              <button
                className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none"
                disabled={!editDescriptionPermissions}
                onClick={() => handleUpdateChart(record, index)}>
                <EditIcon width={16} />
              </button>
            </Tooltip>
          )}
        </Space>
      );
    },
    [chartsPermissionsArray, handleUpdateChart]
  );

  const hasEditTagAccess = (record: ChartType) => {
    const permissionsObject = chartsPermissionsArray?.find(
      (chart) => chart.id === record.id
    )?.permissions;

    return (
      !isUndefined(permissionsObject) &&
      (permissionsObject.EditTags || permissionsObject.EditAll)
    );
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = selectedTags?.map((tag) => ({
      source: tag.source,
      tagFQN: tag.tagFQN,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    }));

    if (updatedTags && dashboardDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedDashboard = { ...dashboardDetails, tags: updatedTags };
      await onDashboardUpdate(updatedDashboard, 'tags');
    }
  };

  const tableColumn: ColumnsType<ChartType> = useMemo(
    () => [
      {
        title: t('label.chart-entity', {
          entity: t('label.name'),
        }),
        dataIndex: 'chartName',
        key: 'chartName',
        width: 200,
        render: (_, record) => {
          const chartName = getEntityName(record);

          return record.sourceUrl ? (
            <Typography.Link href={record.sourceUrl} target="_blank">
              <Space>
                {chartName}
                <ExternalLinkIcon height={14} width={14} />
              </Space>
            </Typography.Link>
          ) : (
            <Typography.Text>{chartName}</Typography.Text>
          );
        },
      },
      {
        title: t('label.chart-entity', {
          entity: t('label.type'),
        }),
        dataIndex: 'chartType',
        key: 'chartType',
        width: 120,
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 350,
        render: renderDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 300,
        render: (tags: TagLabel[], record: ChartType, index: number) => {
          return (
            <TableTags<ChartType>
              dataTestId="classification-tags"
              fetchTags={fetchClassificationTags}
              handleTagSelection={handleChartTagSelection}
              hasTagEditAccess={hasEditTagAccess(record)}
              index={index}
              isReadOnly={deleted}
              isTagLoading={isTagLoading}
              record={record}
              tagFetchFailed={tagFetchFailed}
              tagList={classificationTags}
              tags={getFilterTags(tags)}
              type={TagSource.Classification}
            />
          );
        },
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 300,
        render: (tags: TagLabel[], record: ChartType, index: number) => (
          <TableTags<ChartType>
            dataTestId="glossary-tags"
            fetchTags={fetchGlossaryTags}
            handleTagSelection={handleChartTagSelection}
            hasTagEditAccess={hasEditTagAccess(record)}
            index={index}
            isReadOnly={deleted}
            isTagLoading={isGlossaryLoading}
            record={record}
            tagFetchFailed={tagFetchFailed}
            tagList={glossaryTags}
            tags={getFilterTags(tags)}
            type={TagSource.Glossary}
          />
        ),
      },
    ],
    [
      deleted,
      isTagLoading,
      isGlossaryLoading,
      tagFetchFailed,
      glossaryTags,
      classificationTags,
      renderDescription,
      fetchGlossaryTags,
      handleChartTagSelection,
      hasEditTagAccess,
    ]
  );

  const tabs = useMemo(
    () => [
      {
        label: (
          <TabsLabel id={EntityTabs.DETAILS} name={t('label.detail-plural')} />
        ),
        key: EntityTabs.DETAILS,
        children: (
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-l-lg" flex="auto">
              <div className="d-flex flex-col gap-4">
                <DescriptionV1
                  description={dashboardDetails.description}
                  entityFieldThreads={getEntityFieldThreadCounts(
                    EntityField.DESCRIPTION,
                    entityFieldThreadCount
                  )}
                  entityFqn={dashboardDetails.fullyQualifiedName}
                  entityName={entityName}
                  entityType={EntityType.DASHBOARD}
                  hasEditAccess={
                    dashboardPermissions.EditAll ||
                    dashboardPermissions.EditDescription
                  }
                  isEdit={isEdit}
                  isReadOnly={dashboardDetails.deleted}
                  owner={dashboardDetails.owner}
                  onCancel={onCancel}
                  onDescriptionEdit={onDescriptionEdit}
                  onDescriptionUpdate={onDescriptionUpdate}
                  onThreadLinkSelect={onThreadLinkSelect}
                />

                {isEmpty(charts) ? (
                  <ErrorPlaceHolder />
                ) : (
                  <Table
                    bordered
                    className="p-t-xs"
                    columns={tableColumn}
                    data-testid="charts-table"
                    dataSource={charts}
                    pagination={false}
                    rowKey="id"
                    scroll={{ x: 1200 }}
                    size="small"
                  />
                )}
              </div>
            </Col>
            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="320px">
              <TagsContainerV1
                editable={
                  dashboardPermissions.EditAll || dashboardPermissions.EditTags
                }
                entityFieldThreads={getEntityFieldThreadCounts(
                  EntityField.TAGS,
                  entityFieldThreadCount
                )}
                entityFqn={dashboardDetails.fullyQualifiedName}
                entityType={EntityType.DASHBOARD}
                selectedTags={dashboardTags}
                onSelectionChange={handleTagSelection}
                onThreadLinkSelect={onThreadLinkSelect}
              />
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
              entityType={EntityType.DASHBOARD}
              fqn={dashboardDetails?.fullyQualifiedName ?? ''}
              onFeedUpdate={() => Promise.resolve()}
            />
          </ActivityFeedProvider>
        ),
      },
      {
        label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
        key: EntityTabs.LINEAGE,
        children: (
          <Card className="lineage-card card-body-full w-auto border-none">
            <EntityLineageComponent
              entityType={EntityType.DASHBOARD}
              hasEditAccess={
                dashboardPermissions.EditAll || dashboardPermissions.EditLineage
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
            entityDetails={
              dashboardDetails as CustomPropertyProps['entityDetails']
            }
            entityType={EntityType.DASHBOARD}
            handleExtensionUpdate={onExtensionUpdate}
            hasEditAccess={
              dashboardPermissions.EditAll ||
              dashboardPermissions.EditCustomFields
            }
          />
        ),
      },
    ],
    [
      feedCount,
      activeTab,
      isEdit,
      tableColumn,
      dashboardDetails,
      charts,
      entityFieldTaskCount,
      entityFieldThreadCount,
      entityName,
      dashboardPermissions,
      dashboardTags,
      getEntityFieldThreadCounts,
      onCancel,
      onDescriptionEdit,
      onDescriptionUpdate,
      onThreadLinkSelect,
      handleTagSelection,
    ]
  );

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle="Table details"
      title="Table details">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            dataAsset={dashboardDetails}
            entityType={EntityType.DASHBOARD}
            permissions={dashboardPermissions}
            onDisplayNameUpdate={onUpdateDisplayName}
            onFollowClick={followDashboard}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreDashboard}
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

      {editChart && (
        <ModalWithMarkdownEditor
          header={t('label.edit-chart-name', {
            name: editChart.chart.displayName,
          })}
          placeholder={t('label.enter-field-description', {
            field: t('label.chart'),
          })}
          value={editChart.chart.description || ''}
          visible={Boolean(editChart)}
          onCancel={closeEditChartModal}
          onSave={onChartUpdate}
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

export default DashboardDetails;
