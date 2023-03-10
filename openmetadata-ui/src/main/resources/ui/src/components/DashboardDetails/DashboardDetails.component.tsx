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

import { Card, Space, Table, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { ENTITY_CARD_CLASS } from 'constants/entity.constants';
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import { EntityTags, ExtraInfo, TagOption } from 'Models';
import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { restoreDashboard } from 'rest/dashboardAPI';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityField } from '../../constants/Feeds.constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { SettledStatus } from '../../enums/axios.enum';
import { EntityInfo, EntityType } from '../../enums/entity.enum';
import { OwnerType } from '../../enums/user.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { ThreadType } from '../../generated/entity/feed/thread';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { LabelType, State, TagLabel } from '../../generated/type/tagLabel';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import {
  getCurrentUserId,
  getEntityName,
  getEntityPlaceHolder,
  getOwnerValue,
  refreshPage,
} from '../../utils/CommonUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import {
  fetchGlossaryTerms,
  getGlossaryTermlist,
} from '../../utils/GlossaryUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getTagsWithoutTier } from '../../utils/TableUtils';
import { getClassifications, getTaglist } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from '../common/CustomPropertyTable/CustomPropertyTable.interface';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainerV1 from '../containers/PageContainerV1';
import EntityLineageComponent from '../EntityLineage/EntityLineage.component';
import Loader from '../Loader/Loader';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import TagsContainer from '../Tag/TagsContainer/tags-container';
import TagsViewer from '../Tag/TagsViewer/tags-viewer';
import { ChartType, DashboardDetailsProps } from './DashboardDetails.interface';

const DashboardDetails = ({
  entityName,
  followers,
  followDashboardHandler,
  unfollowDashboardHandler,
  owner,
  tier,
  slashedDashboardName,
  activeTab,
  setActiveTabHandler,
  description,
  serviceType,
  dashboardUrl,
  dashboardTags,
  dashboardDetails,
  descriptionUpdateHandler,
  settingsUpdateHandler,
  tagUpdateHandler,
  charts,
  chartDescriptionUpdateHandler,
  chartTagUpdateHandler,
  versionHandler,
  version,
  deleted,
  entityThread,
  isentityThreadLoading,
  postFeedHandler,
  feedCount,
  entityFieldThreadCount,
  createThread,
  dashboardFQN,
  deletePostHandler,
  paging,
  fetchFeedHandler,
  updateThreadHandler,
  entityFieldTaskCount,
  onExtensionUpdate,
}: DashboardDetailsProps) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [editChart, setEditChart] = useState<{
    chart: ChartType;
    index: number;
  }>();
  const [editChartTags, setEditChartTags] = useState<{
    chart: ChartType;
    index: number;
  }>();
  const [tagList, setTagList] = useState<Array<TagOption>>([]);
  const [tagFetchFailed, setTagFetchFailed] = useState<boolean>(false);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [threadLink, setThreadLink] = useState<string>('');

  const [elementRef, isInView] = useInfiniteScroll(observerOptions);
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const [dashboardPermissions, setDashboardPermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

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

  const setFollowersData = (followers: Array<EntityReference>) => {
    setIsFollowing(
      followers.some(({ id }: { id: string }) => id === getCurrentUserId())
    );
    setFollowersCount(followers?.length);
  };
  const tabs = [
    {
      name: t('label.detail-plural'),
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Details',
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
      name: t('label.lineage'),
      icon: {
        alt: 'lineage',
        name: 'icon-lineage',
        title: 'Lineage',
        selectedName: 'icon-lineagecolor',
      },
      isProtected: false,
      position: 3,
    },
    {
      name: t('label.custom-property-plural'),
      isProtected: false,
      position: 4,
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
    {
      key: `${serviceType} ${EntityInfo.URL}`,
      value: dashboardUrl,
      placeholderText: entityName,
      isLink: true,
      openInNewTab: true,
    },
  ];

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };
  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedDashboardDetails = {
        ...dashboardDetails,
        description: updatedHTML,
      };
      try {
        await descriptionUpdateHandler(updatedDashboardDetails);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsEdit(false);
      }
    } else {
      setIsEdit(false);
    }
  };

  const onOwnerUpdate = (newOwner?: Dashboard['owner']) => {
    if (newOwner) {
      const updatedDashboardDetails = {
        ...dashboardDetails,
        owner: newOwner
          ? { ...dashboardDetails.owner, ...newOwner }
          : dashboardDetails.owner,
      };
      settingsUpdateHandler(updatedDashboardDetails);
    }
  };

  const onOwnerRemove = () => {
    if (dashboardDetails) {
      const updatedDashboardDetails = {
        ...dashboardDetails,
        owner: undefined,
      };
      settingsUpdateHandler(updatedDashboardDetails);
    }
  };

  const onTierUpdate = (newTier?: string) => {
    if (newTier) {
      const tierTag: Dashboard['tags'] = newTier
        ? [
            ...getTagsWithoutTier(dashboardDetails.tags as Array<EntityTags>),
            {
              tagFQN: newTier,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ]
        : dashboardDetails.tags;
      const updatedDashboardDetails = {
        ...dashboardDetails,
        tags: tierTag,
      };
      settingsUpdateHandler(updatedDashboardDetails);
    }
  };

  const onRemoveTier = () => {
    if (dashboardDetails) {
      const updatedDashboardDetails = {
        ...dashboardDetails,
        tags: undefined,
      };
      settingsUpdateHandler(updatedDashboardDetails);
    }
  };

  const onTagUpdate = (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedDashboard = { ...dashboardDetails, tags: updatedTags };
      tagUpdateHandler(updatedDashboard);
    }
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

  const followDashboard = () => {
    if (isFollowing) {
      setFollowersCount((preValu) => preValu - 1);
      setIsFollowing(false);
      unfollowDashboardHandler();
    } else {
      setFollowersCount((preValu) => preValu + 1);
      setIsFollowing(true);
      followDashboardHandler();
    }
  };
  const handleUpdateChart = (chart: ChartType, index: number) => {
    setEditChart({ chart, index });
  };
  const handleEditChartTag = (chart: ChartType, index: number): void => {
    setEditChartTags({ chart, index });
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

  const handleChartTagSelection = (
    selectedTags?: Array<EntityTags>,
    chart?: {
      chart: ChartType;
      index: number;
    }
  ) => {
    const chartTag = isUndefined(editChartTags) ? chart : editChartTags;
    if (selectedTags && chartTag) {
      const prevTags = chartTag.chart.tags?.filter((tag) =>
        selectedTags.some((selectedTag) => selectedTag.tagFQN === tag.tagFQN)
      );
      const newTags = selectedTags
        .filter(
          (selectedTag) =>
            !chartTag.chart.tags?.some(
              (tag) => tag.tagFQN === selectedTag.tagFQN
            )
        )
        .map((tag) => ({
          labelType: 'Manual',
          state: 'Confirmed',
          source: tag.source,
          tagFQN: tag.tagFQN,
        }));

      const updatedChart = {
        ...chartTag.chart,
        tags: [...(prevTags as TagLabel[]), ...newTags],
      };
      const jsonPatch = compare(charts[chartTag.index], updatedChart);
      chartTagUpdateHandler(chartTag.index, chartTag.chart.id, jsonPatch);
    }
    setEditChartTags(undefined);
  };

  const fetchTagsAndGlossaryTerms = () => {
    setIsTagLoading(true);
    Promise.allSettled([getClassifications(), fetchGlossaryTerms()])
      .then(async (values) => {
        let tagsAndTerms: TagOption[] = [];
        if (
          values[0].status === SettledStatus.FULFILLED &&
          values[0].value.data
        ) {
          const tagList = await getTaglist(values[0].value.data);
          tagsAndTerms = tagList.map((tag) => {
            return { fqn: tag, source: 'Classification' };
          });
        }
        if (
          values[1].status === SettledStatus.FULFILLED &&
          values[1].value &&
          values[1].value.length > 0
        ) {
          const glossaryTerms: TagOption[] = getGlossaryTermlist(
            values[1].value
          ).map((tag) => {
            return { fqn: tag, source: 'Glossary' };
          });
          tagsAndTerms = [...tagsAndTerms, ...glossaryTerms];
        }
        setTagList(tagsAndTerms);
        if (
          values[0].status === SettledStatus.FULFILLED &&
          values[1].status === SettledStatus.FULFILLED
        ) {
          setTagFetchFailed(false);
        } else {
          setTagFetchFailed(true);
        }
      })
      .catch(() => {
        setTagList([]);
        setTagFetchFailed(true);
      })
      .finally(() => {
        setIsTagLoading(false);
      });
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

  const handleTagContainerClick = (chart: ChartType, index: number) => {
    if (!editChartTags) {
      // Fetch tags and terms only once
      if (tagList.length === 0 || tagFetchFailed) {
        fetchTagsAndGlossaryTerms();
      }
      handleEditChartTag(chart, index);
    }
  };

  useEffect(() => {
    setFollowersData(followers);
  }, [followers]);

  useEffect(() => {
    fetchMoreThread(isInView as boolean, paging, isentityThreadLoading);
  }, [paging, isentityThreadLoading, isInView]);

  const handleFeedFilterChange = useCallback(
    (feedType, threadType) => {
      fetchFeedHandler(paging.after, feedType, threadType);
    },
    [paging]
  );

  const tableColumn: ColumnsType<ChartType> = useMemo(
    () => [
      {
        title: t('label.chart-entity', {
          entity: t('label.name'),
        }),
        dataIndex: 'chartName',
        key: 'chartName',
        width: 200,
        render: (_, record) => (
          <Link target="_blank" to={{ pathname: record.chartUrl }}>
            <Space>
              <span>{getEntityName(record as unknown as EntityReference)}</span>
              <SVGIcons
                alt="external-link"
                className="tw-align-middle"
                icon="external-link"
                width="16px"
              />
            </Space>
          </Link>
        ),
      },
      {
        title: t('label.chart-entity', {
          entity: t('label.type'),
        }),
        dataIndex: 'chartType',
        key: 'chartType',
        width: 100,
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 300,
        render: (text, record, index) => (
          <Space
            className="w-full tw-group cursor-pointer"
            data-testid="description">
            <div>
              {text ? (
                <RichTextEditorPreviewer markdown={text} />
              ) : (
                <span className="tw-no-description">
                  {t('label.no-entity', {
                    entity: t('label.description'),
                  })}
                </span>
              )}
            </div>
            {!deleted && (
              <Tooltip
                title={
                  dashboardPermissions.EditAll
                    ? t('label.edit-entity', { entity: t('label.description') })
                    : t('message.no-permission-for-action')
                }>
                <button
                  className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none"
                  disabled={!dashboardPermissions.EditAll}
                  onClick={() => handleUpdateChart(record, index)}>
                  <SVGIcons
                    alt="edit"
                    icon="icon-edit"
                    title="Edit"
                    width="16px"
                  />
                </button>
              </Tooltip>
            )}
          </Space>
        ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        width: 300,
        render: (tags: Dashboard['tags'], record, index) => {
          return (
            <div
              className="relative tableBody-cell"
              data-testid="tags-wrapper"
              onClick={() => handleTagContainerClick(record, index)}>
              {deleted ? (
                <Space>
                  <TagsViewer sizeCap={-1} tags={tags || []} />
                </Space>
              ) : (
                <TagsContainer
                  editable={editChartTags?.index === index}
                  isLoading={isTagLoading && editChartTags?.index === index}
                  selectedTags={tags || []}
                  showAddTagButton={
                    dashboardPermissions.EditAll ||
                    dashboardPermissions.EditTags
                  }
                  size="small"
                  tagList={tagList}
                  type="label"
                  onCancel={() => {
                    handleChartTagSelection();
                  }}
                  onSelectionChange={(tags) => {
                    handleChartTagSelection(tags, {
                      chart: record,
                      index,
                    });
                  }}
                />
              )}
            </div>
          );
        },
      },
    ],
    [
      dashboardPermissions.EditAll,
      dashboardPermissions.EditTags,
      editChartTags,
      tagList,
      deleted,
      isTagLoading,
      charts,
    ]
  );

  return (
    <PageContainerV1>
      <div className="entity-details-container">
        <EntityPageInfo
          canDelete={dashboardPermissions.Delete}
          currentOwner={dashboardDetails.owner}
          deleted={deleted}
          entityFieldTasks={getEntityFieldThreadCounts(
            EntityField.TAGS,
            entityFieldTaskCount
          )}
          entityFieldThreads={getEntityFieldThreadCounts(
            EntityField.TAGS,
            entityFieldThreadCount
          )}
          entityFqn={dashboardFQN}
          entityId={dashboardDetails.id}
          entityName={entityName}
          entityType={EntityType.DASHBOARD}
          extraInfo={extraInfo}
          followHandler={followDashboard}
          followers={followersCount}
          followersList={followers}
          isFollowing={isFollowing}
          isTagEditable={
            dashboardPermissions.EditAll || dashboardPermissions.EditTags
          }
          removeOwner={
            dashboardPermissions.EditAll || dashboardPermissions.EditOwner
              ? onOwnerRemove
              : undefined
          }
          removeTier={
            dashboardPermissions.EditAll || dashboardPermissions.EditTier
              ? onRemoveTier
              : undefined
          }
          tags={dashboardTags}
          tagsHandler={onTagUpdate}
          tier={tier || ''}
          titleLinks={slashedDashboardName}
          updateOwner={
            dashboardPermissions.EditAll || dashboardPermissions.EditOwner
              ? onOwnerUpdate
              : undefined
          }
          updateTier={
            dashboardPermissions.EditAll || dashboardPermissions.EditTier
              ? onTierUpdate
              : undefined
          }
          version={version}
          versionHandler={versionHandler}
          onRestoreEntity={handleRestoreDashboard}
          onThreadLinkSelect={onThreadLinkSelect}
        />
        <div className="tw-mt-4 tw-flex tw-flex-col tw-flex-grow">
          <TabsPane
            activeTab={activeTab}
            className="tw-flex-initial"
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
                    entityFqn={dashboardFQN}
                    entityName={entityName}
                    entityType={EntityType.DASHBOARD}
                    hasEditAccess={
                      dashboardPermissions.EditAll ||
                      dashboardPermissions.EditDescription
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
              <Table
                bordered
                className="p-t-xs"
                columns={tableColumn}
                data-testid="charts-table"
                dataSource={charts}
                pagination={false}
                rowKey="id"
                size="small"
              />
            </Card>
          )}
          {activeTab === 2 && (
            <Card className={ENTITY_CARD_CLASS}>
              <div
                className="tw-py-4 tw-px-7 tw-grid tw-grid-cols-3 entity-feed-list tw--mx-7 tw--my-4"
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
            <Card className={`${ENTITY_CARD_CLASS} card-body-full`}>
              <EntityLineageComponent
                entityType={EntityType.DASHBOARD}
                hasEditAccess={
                  dashboardPermissions.EditAll ||
                  dashboardPermissions.EditLineage
                }
              />
            </Card>
          )}
          {activeTab === 4 && (
            <Card className={ENTITY_CARD_CLASS}>
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
            </Card>
          )}
          <div
            data-testid="observer-element"
            id="observer-element"
            ref={elementRef as RefObject<HTMLDivElement>}>
            {getLoader()}
          </div>
        </div>
      </div>
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
          deletePostHandler={deletePostHandler}
          open={Boolean(threadLink)}
          postFeedHandler={postFeedHandler}
          threadLink={threadLink}
          threadType={threadType}
          updateThreadHandler={updateThreadHandler}
          onCancel={onThreadPanelClose}
        />
      ) : null}
    </PageContainerV1>
  );
};

export default DashboardDetails;
