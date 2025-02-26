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
import { Col, Row, Table, Tabs, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { groupBy, isEmpty, isUndefined, uniqBy } from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ReactComponent as ExternalLinkIcon } from '../../../assets/svg/external-links.svg';
import {
  DATA_ASSET_ICON_DIMENSION,
  getEntityDetailsPath,
} from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../../constants/ResizablePanel.constants';
import LineageProvider from '../../../context/LineageProvider/LineageProvider';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { TagSource } from '../../../generated/type/schema';
import { TagLabel } from '../../../generated/type/tagLabel';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { restoreDashboard } from '../../../rest/dashboardAPI';
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
import { EntityDescriptionProvider } from '../../common/EntityDescription/EntityDescriptionProvider/EntityDescriptionProvider';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
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
import {
  ChartsPermissions,
  ChartType,
  DashboardDetailsProps,
} from './DashboardDetails.interface';

const DashboardDetails = ({
  updateDashboardDetailsState,
  charts,
  dashboardDetails,
  fetchDashboard,
  followDashboardHandler,
  unFollowDashboardHandler,
  chartDescriptionUpdateHandler,
  chartTagUpdateHandler,
  versionHandler,
  createThread,
  onUpdateVote,
  onDashboardUpdate,
  handleToggleDelete,
}: DashboardDetailsProps) => {
  const { t } = useTranslation();
  const { currentUser, theme } = useApplicationStore();
  const history = useHistory();
  const { tab: activeTab = EntityTabs.DETAILS } =
    useParams<{ tab: EntityTabs }>();

  const { fqn: decodedDashboardFQN } = useFqn();

  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const [isEdit, setIsEdit] = useState(false);
  const [editChart, setEditChart] = useState<{
    chart: ChartType;
    index: number;
  }>();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
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

  const {
    owners,
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
      isFollowing: followers?.some(({ id }) => id === currentUser?.id),
    };
  }, [followers, currentUser]);

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

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.DASHBOARD, decodedDashboardFQN, handleFeedCount);

  useEffect(() => {
    getEntityFeedCount();
  }, [decodedDashboardFQN]);

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

  useEffect(() => {
    if (charts) {
      getAllChartsPermissions(charts);
    }
  }, [charts]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(
        getEntityDetailsPath(
          EntityType.DASHBOARD,
          decodedDashboardFQN,
          activeKey
        )
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
    async (newOwners?: Dashboard['owners']) => {
      const updatedDashboard = {
        ...dashboardDetails,
        owners: newOwners,
      };
      await onDashboardUpdate(updatedDashboard, 'owners');
    },
    [owners]
  );

  const onTierUpdate = async (newTier?: Tag) => {
    const tierTag = updateTierTag(dashboardDetails?.tags ?? [], newTier);
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
    await onDashboardUpdate(
      { ...dashboardDetails, extension: updatedData.extension },
      'extension'
    );
  };

  const handleRestoreDashboard = async () => {
    try {
      const { version: newVersion } = await restoreDashboard(
        dashboardDetails.id
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.dashboard'),
        }),
        2000
      );
      handleToggleDelete(newVersion);
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
    editColumnTag: ChartType
  ) => {
    if (selectedTags && editColumnTag) {
      const prevTags = editColumnTag.tags?.filter((tag) =>
        selectedTags.some((selectedTag) => selectedTag.tagFQN === tag.tagFQN)
      );
      const newTags = createTagObject(
        selectedTags.filter(
          (selectedTag) =>
            !editColumnTag.tags?.some(
              (tag) => tag.tagFQN === selectedTag.tagFQN
            )
        )
      );

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

  const hasEditTagAccess = (record: ChartType) => {
    const permissionsObject = chartsPermissionsArray?.find(
      (chart) => chart.id === record.id
    )?.permissions;

    return (
      !isUndefined(permissionsObject) &&
      (permissionsObject.EditTags || permissionsObject.EditAll)
    );
  };

  const hasEditGlossaryTermAccess = (record: ChartType) => {
    const permissionsObject = chartsPermissionsArray?.find(
      (chart) => chart.id === record.id
    )?.permissions;

    return (
      !isUndefined(permissionsObject) &&
      (permissionsObject.EditGlossaryTerms || permissionsObject.EditAll)
    );
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && dashboardDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedDashboard = { ...dashboardDetails, tags: updatedTags };
      await onDashboardUpdate(updatedDashboard, 'tags');
    }
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? handleToggleDelete(version) : history.push('/'),
    []
  );

  const tagFilter = useMemo(() => {
    const tags = getAllTags(charts);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [charts]);

  const tableColumn: ColumnsType<ChartType> = useMemo(
    () => [
      {
        title: t('label.chart-entity', {
          entity: t('label.name'),
        }),
        dataIndex: 'chartName',
        key: 'chartName',
        width: 220,
        fixed: 'left',
        sorter: getColumnSorter<ChartType, 'name'>('name'),
        render: (_, record) => {
          const chartName = getEntityName(record);

          return record.sourceUrl ? (
            <div className="d-flex items-center">
              <Typography.Link href={record.sourceUrl} target="_blank">
                <span className="break-all">{chartName}</span>

                <Icon
                  className="m-l-xs flex-none align-middle"
                  component={ExternalLinkIcon}
                  style={DATA_ASSET_ICON_DIMENSION}
                />
              </Typography.Link>
            </div>
          ) : (
            <Typography.Text className="w-full">{chartName}</Typography.Text>
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
        render: (_, record, index) => {
          const permissionsObject = chartsPermissionsArray?.find(
            (chart) => chart.id === record.id
          )?.permissions;

          const editDescriptionPermissions =
            !isUndefined(permissionsObject) &&
            (permissionsObject.EditDescription || permissionsObject.EditAll);

          return (
            <TableDescription
              columnData={{
                fqn: record.fullyQualifiedName ?? '',
                field: record.description,
              }}
              entityFqn={decodedDashboardFQN}
              entityType={EntityType.DASHBOARD}
              hasEditPermission={editDescriptionPermissions}
              index={index}
              isReadOnly={deleted}
              onClick={() => handleUpdateChart(record, index)}
              onThreadLinkSelect={onThreadLinkSelect}
            />
          );
        },
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
        render: (tags: TagLabel[], record: ChartType, index: number) => {
          return (
            <TableTags<ChartType>
              entityFqn={decodedDashboardFQN}
              entityType={EntityType.DASHBOARD}
              handleTagSelection={handleChartTagSelection}
              hasTagEditAccess={hasEditTagAccess(record)}
              index={index}
              isReadOnly={deleted}
              record={record}
              tags={tags}
              type={TagSource.Classification}
              onThreadLinkSelect={onThreadLinkSelect}
            />
          );
        },
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
        render: (tags: TagLabel[], record: ChartType, index: number) => (
          <TableTags<ChartType>
            entityFqn={decodedDashboardFQN}
            entityType={EntityType.DASHBOARD}
            handleTagSelection={handleChartTagSelection}
            hasTagEditAccess={hasEditGlossaryTermAccess(record)}
            index={index}
            isReadOnly={deleted}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        ),
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
      },
    ],
    [
      deleted,
      chartsPermissionsArray,
      onThreadLinkSelect,
      hasEditTagAccess,
      handleUpdateChart,
      handleChartTagSelection,
      charts,
    ]
  );

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editAllPermission,
    editLineagePermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (dashboardPermissions.EditTags || dashboardPermissions.EditAll) &&
        !deleted,
      editGlossaryTermsPermission:
        (dashboardPermissions.EditGlossaryTerms ||
          dashboardPermissions.EditAll) &&
        !deleted,
      editDescriptionPermission:
        (dashboardPermissions.EditDescription ||
          dashboardPermissions.EditAll) &&
        !deleted,
      editCustomAttributePermission:
        (dashboardPermissions.EditAll ||
          dashboardPermissions.EditCustomFields) &&
        !deleted,
      editAllPermission: dashboardPermissions.EditAll && !deleted,
      editLineagePermission:
        (dashboardPermissions.EditAll || dashboardPermissions.EditLineage) &&
        !deleted,
      viewAllPermission: dashboardPermissions.ViewAll,
    }),
    [dashboardPermissions, deleted]
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
            <Col className="tab-content-height-with-resizable-panel" span={24}>
              <ResizablePanels
                firstPanel={{
                  className: 'entity-resizable-panel-container',
                  children: (
                    <div className="d-flex flex-col gap-4 p-t-sm m-x-lg">
                      <DescriptionV1
                        description={dashboardDetails.description}
                        entityFqn={decodedDashboardFQN}
                        entityName={entityName}
                        entityType={EntityType.DASHBOARD}
                        hasEditAccess={editDescriptionPermission}
                        isDescriptionExpanded={isEmpty(charts)}
                        isEdit={isEdit}
                        owner={dashboardDetails.owners}
                        showActions={!deleted}
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
                          className="align-table-filter-left"
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
                  ),
                  ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
                }}
                secondPanel={{
                  children: (
                    <div data-testid="entity-right-panel">
                      <EntityRightPanel<EntityType.DASHBOARD>
                        customProperties={dashboardDetails}
                        dataProducts={dashboardDetails?.dataProducts ?? []}
                        domain={dashboardDetails?.domain}
                        editCustomAttributePermission={
                          editCustomAttributePermission
                        }
                        editGlossaryTermsPermission={
                          editGlossaryTermsPermission
                        }
                        editTagPermission={editTagsPermission}
                        entityFQN={decodedDashboardFQN}
                        entityId={dashboardDetails.id}
                        entityType={EntityType.DASHBOARD}
                        selectedTags={dashboardTags}
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
            entityType={EntityType.DASHBOARD}
            fqn={dashboardDetails?.fullyQualifiedName ?? ''}
            onFeedUpdate={getEntityFeedCount}
            onUpdateEntityDetails={fetchDashboard}
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
              deleted={deleted}
              entity={dashboardDetails as SourceType}
              entityType={EntityType.DASHBOARD}
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
        children: dashboardDetails && (
          <div className="m-sm">
            <CustomPropertyTable<EntityType.DASHBOARD>
              entityDetails={dashboardDetails}
              entityType={EntityType.DASHBOARD}
              handleExtensionUpdate={onExtensionUpdate}
              hasEditAccess={editCustomAttributePermission}
              hasPermission={viewAllPermission}
            />
          </div>
        ),
      },
    ],
    [
      feedCount.totalCount,
      activeTab,
      isEdit,
      tableColumn,
      dashboardDetails,
      charts,
      deleted,
      entityName,
      dashboardTags,
      onCancel,
      handleFeedCount,
      onDescriptionEdit,
      onDescriptionUpdate,
      onThreadLinkSelect,
      handleTagSelection,
      editTagsPermission,
      editGlossaryTermsPermission,
      editLineagePermission,
      editDescriptionPermission,
      editCustomAttributePermission,
      editAllPermission,
      viewAllPermission,
    ]
  );

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.dashboard'),
      })}
      title="Table details">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateDashboardDetailsState}
            dataAsset={dashboardDetails}
            entityType={EntityType.DASHBOARD}
            openTaskCount={feedCount.openTaskCount}
            permissions={dashboardPermissions}
            onDisplayNameUpdate={onUpdateDisplayName}
            onFollowClick={followDashboard}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreDashboard}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
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
        <EntityDescriptionProvider
          entityFqn={editChart.chart.fullyQualifiedName}
          entityType={EntityType.CHART}>
          <ModalWithMarkdownEditor
            header={t('label.edit-chart-name', {
              name: getEntityName(editChart.chart),
            })}
            placeholder={t('label.enter-field-description', {
              field: t('label.chart'),
            })}
            value={editChart.chart.description ?? ''}
            visible={Boolean(editChart)}
            onCancel={closeEditChartModal}
            onSave={onChartUpdate}
          />
        </EntityDescriptionProvider>
      )}
      <LimitWrapper resource="dashboard">
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

export default withActivityFeed<DashboardDetailsProps>(DashboardDetails);
