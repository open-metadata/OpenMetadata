/*
 *  Copyright 2023 Collate.
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
import AppState from 'AppState';
import { AxiosError } from 'axios';
import ActivityFeedList from 'components/ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from 'components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import Description from 'components/common/description/Description';
import EntityPageInfo from 'components/common/entityPageInfo/EntityPageInfo';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import PageContainerV1 from 'components/containers/PageContainerV1';
import ModelTab from 'components/DataModels/ModelTab/ModelTab.component';
import EntityLineageComponent from 'components/EntityLineage/EntityLineage.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import SchemaEditor from 'components/schema-editor/SchemaEditor';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { getServiceDetailsPath } from 'constants/constants';
import { EntityField } from 'constants/Feeds.constants';
import { NO_PERMISSION_TO_VIEW } from 'constants/HelperTextUtil';
import { CSMode } from 'enums/codemirror.enum';
import { EntityInfo, EntityType } from 'enums/entity.enum';
import { FeedFilter } from 'enums/mydata.enum';
import { ServiceCategory } from 'enums/service.enum';
import { OwnerType } from 'enums/user.enum';
import { compare, Operation } from 'fast-json-patch';
import { CreateThread } from 'generated/api/feed/createThread';
import { DashboardDataModel } from 'generated/entity/data/dashboardDataModel';
import { Post, Thread, ThreadType } from 'generated/entity/feed/thread';
import { Paging } from 'generated/type/paging';
import { LabelType, State, TagSource } from 'generated/type/tagLabel';
import { EntityFieldThreadCount } from 'interface/feed.interface';
import jsonData from 'jsons/en';
import { isUndefined, omitBy } from 'lodash';
import { EntityTags, ExtraInfo } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  addDataModelFollower,
  getDataModelsByName,
  patchDataModelDetails,
  removeDataModelFollower,
} from 'rest/dataModelsAPI';
import { getAllFeeds, postFeedById, postThread } from 'rest/feedsAPI';
import {
  getCountBadge,
  getCurrentUserId,
  getEntityMissingError,
  getEntityPlaceHolder,
  getFeedCounts,
  getOwnerValue,
} from 'utils/CommonUtils';
import { getDataModelsDetailPath } from 'utils/DataModelsUtils';
import { getEntityFeedLink, getEntityName } from 'utils/EntityUtils';
import {
  deletePost,
  getEntityFieldThreadCounts,
  updateThreadData,
} from 'utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from 'utils/TableUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { DATA_MODELS_DETAILS_TABS } from './DataModelsInterface';

const DataModelsPage = () => {
  const history = useHistory();
  const { t } = useTranslation();

  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { dashboardDataModelFQN, tab } = useParams() as Record<string, string>;

  const [isEditDescription, setIsEditDescription] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [dataModelPermissions, setDataModelPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [dataModelData, setDataModelData] = useState<DashboardDataModel>();

  const [threadLink, setThreadLink] = useState<string>('');
  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [isEntityThreadLoading, setIsEntityThreadLoading] =
    useState<boolean>(false);
  const [paging, setPaging] = useState<Paging>({} as Paging);

  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  const [entityFieldTaskCount, setEntityFieldTaskCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const {
    hasViewPermission,
    hasEditDescriptionPermission,
    hasEditOwnerPermission,
    hasEditTagsPermission,
    hasEditTierPermission,
    hasEditLineagePermission,
  } = useMemo(() => {
    return {
      hasViewPermission:
        dataModelPermissions.ViewAll || dataModelPermissions.ViewBasic,
      hasEditDescriptionPermission:
        dataModelPermissions.EditAll || dataModelPermissions.EditDescription,
      hasEditOwnerPermission:
        dataModelPermissions.EditAll || dataModelPermissions.EditOwner,
      hasEditTagsPermission:
        dataModelPermissions.EditAll || dataModelPermissions.EditTags,
      hasEditTierPermission:
        dataModelPermissions.EditAll || dataModelPermissions.EditTier,
      hasEditLineagePermission:
        dataModelPermissions.EditAll || dataModelPermissions.EditLineage,
    };
  }, [dataModelPermissions]);

  const {
    tier,
    deleted,
    owner,
    description,
    version,
    tags,
    entityName,
    entityId,
    followers,
    isUserFollowing,
  } = useMemo(() => {
    return {
      deleted: dataModelData?.deleted,
      owner: dataModelData?.owner,
      description: dataModelData?.description,
      version: dataModelData?.version,
      tier: getTierTags(dataModelData?.tags ?? []),
      tags: getTagsWithoutTier(dataModelData?.tags ?? []),
      entityId: dataModelData?.id,
      entityName: getEntityName(dataModelData),
      isUserFollowing: dataModelData?.followers?.some(
        ({ id }: { id: string }) => id === getCurrentUserId()
      ),
      followers: dataModelData?.followers ?? [],
    };
  }, [dataModelData]);

  const breadcrumbTitles = useMemo(() => {
    const service = dataModelData?.service;
    const serviceName = service?.name;

    return [
      {
        name: serviceName || '',
        url: serviceName
          ? getServiceDetailsPath(
              serviceName,
              ServiceCategory.DASHBOARD_SERVICES
            )
          : '',
      },
    ];
  }, [dataModelData, dashboardDataModelFQN, entityName]);

  const getFeedData = useCallback(
    async (
      after?: string,
      feedFilter?: FeedFilter,
      threadType?: ThreadType
    ) => {
      setIsEntityThreadLoading(true);
      !after && setEntityThread([]);

      try {
        const { data, paging: pagingObj } = await getAllFeeds(
          getEntityFeedLink(
            EntityType.DASHBOARD_DATA_MODEL,
            dashboardDataModelFQN
          ),
          after,
          threadType,
          feedFilter,
          undefined,
          currentUser?.id
        );
        setPaging(pagingObj);
        setEntityThread((prevData) => [...prevData, ...data]);
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.feed-plural'),
          })
        );
      } finally {
        setIsEntityThreadLoading(false);
      }
    },
    [dashboardDataModelFQN]
  );

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.DASHBOARD_DATA_MODEL,
      dashboardDataModelFQN,
      setEntityFieldThreadCount,
      setEntityFieldTaskCount,
      setFeedCount
    );
  };

  const deletePostHandler = (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => {
    deletePost(threadId, postId, isThread, setEntityThread);
  };

  const onThreadLinkSelect = (link: string) => {
    setThreadLink(link);
  };

  const postFeedHandler = (value: string, id: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

    const data = {
      message: value,
      from: currentUser,
    } as Post;
    postFeedById(id, data)
      .then((res) => {
        if (res) {
          const { id, posts } = res;
          setEntityThread((pre) => {
            return pre.map((thread) => {
              if (thread.id === id) {
                return { ...res, posts: posts?.slice(-3) };
              } else {
                return thread;
              }
            });
          });
          getEntityFeedCount();
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['add-feed-error']);
      });
  };

  const updateThreadHandler = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    updateThreadData(threadId, postId, isThread, data, setEntityThread);
  };

  const handleFeedFilterChange = useCallback(
    (feedType, threadType) => {
      getFeedData(undefined, feedType, threadType);
    },
    [paging]
  );
  const fetchResourcePermission = async (dashboardDataModelFQN: string) => {
    setIsLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.CONTAINER,
        dashboardDataModelFQN
      );
      setDataModelPermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.asset-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const createThread = (data: CreateThread) => {
    postThread(data)
      .then((res) => {
        if (res) {
          setEntityThread((pre) => [...pre, res]);
          getEntityFeedCount();
        } else {
          showErrorToast(
            jsonData['api-error-messages']['unexpected-server-response']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['create-conversation-error']
        );
      });
  };
  const fetchDataModelDetails = async (dashboardDataModelFQN: string) => {
    setIsLoading(true);
    try {
      const response = await getDataModelsByName(
        dashboardDataModelFQN,
        'owner,tags,followers'
      );
      setDataModelData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const handleTabChange = (tabValue: string) => {
    if (tabValue !== tab) {
      history.push({
        pathname: getDataModelsDetailPath(dashboardDataModelFQN, tabValue),
      });
    }
  };

  const handleUpdateDataModelData = (updatedData: DashboardDataModel) => {
    const jsonPatch = compare(omitBy(dataModelData, isUndefined), updatedData);

    return patchDataModelDetails(dataModelData?.id ?? '', jsonPatch);
  };

  const handleUpdateDescription = async (updatedDescription: string) => {
    try {
      const { description: newDescription, version } =
        await handleUpdateDataModelData({
          ...(dataModelData as DashboardDataModel),
          description: updatedDescription,
        });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        description: newDescription,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleFollowDataModel = async () => {
    const followerId = currentUser?.id ?? '';
    const dataModelId = dataModelData?.id ?? '';
    try {
      if (isUserFollowing) {
        const response = await removeDataModelFollower(dataModelId, followerId);
        const { oldValue } = response.changeDescription.fieldsDeleted[0];

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          followers: (dataModelData?.followers || []).filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        }));
      } else {
        const response = await addDataModelFollower(dataModelId, followerId);
        const { newValue } = response.changeDescription.fieldsAdded[0];

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          followers: [...(dataModelData?.followers ?? []), ...newValue],
        }));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const extraInfo: Array<ExtraInfo> = [
    {
      key: EntityInfo.OWNER,
      value: owner && getOwnerValue(owner),
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
  ];

  const handleRemoveTier = async () => {
    try {
      const { tags: newTags, version } = await handleUpdateDataModelData({
        ...(dataModelData as DashboardDataModel),
        tags: getTagsWithoutTier(dataModelData?.tags ?? []),
      });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        tags: newTags,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateTags = async (selectedTags: Array<EntityTags> = []) => {
    try {
      const { tags: newTags, version } = await handleUpdateDataModelData({
        ...(dataModelData as DashboardDataModel),
        tags: [...(tier ? [tier] : []), ...selectedTags],
      });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        tags: newTags,
        version,
      }));
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateOwner = useCallback(
    async (updatedOwner?: DashboardDataModel['owner']) => {
      try {
        const { owner: newOwner, version } = await handleUpdateDataModelData({
          ...(dataModelData as DashboardDataModel),
          owner: updatedOwner ? updatedOwner : undefined,
        });

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          owner: newOwner,
          version,
        }));
        getEntityFeedCount();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [dataModelData, dataModelData?.owner]
  );

  const handleUpdateTier = async (updatedTier?: string) => {
    try {
      if (updatedTier) {
        const { tags: newTags, version } = await handleUpdateDataModelData({
          ...(dataModelData as DashboardDataModel),
          tags: [
            ...getTagsWithoutTier(dataModelData?.tags ?? []),
            {
              tagFQN: updatedTier,
              labelType: LabelType.Manual,
              state: State.Confirmed,
              source: TagSource.Classification,
            },
          ],
        });

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          tags: newTags,
          version,
        }));
        getEntityFeedCount();
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateDataModel = async (
    updatedDataModel: DashboardDataModel['columns']
  ) => {
    try {
      const { columns: newColumns, version } = await handleUpdateDataModelData({
        ...(dataModelData as DashboardDataModel),
        columns: updatedDataModel,
      });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        columns: newColumns,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    if (tab === DATA_MODELS_DETAILS_TABS.ACTIVITY) {
      getFeedData();
    }
  }, [tab, dashboardDataModelFQN]);

  useEffect(() => {
    if (hasViewPermission) {
      fetchDataModelDetails(dashboardDataModelFQN);
      getEntityFeedCount();
    }
  }, [dashboardDataModelFQN, dataModelPermissions]);

  useEffect(() => {
    fetchResourcePermission(dashboardDataModelFQN);
  }, [dashboardDataModelFQN]);

  // Rendering
  if (isLoading) {
    return <Loader />;
  }

  if (hasError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(t('label.data-model'), dashboardDataModelFQN)}
      </ErrorPlaceHolder>
    );
  }

  if (!hasViewPermission && !isLoading) {
    return <ErrorPlaceHolder>{NO_PERMISSION_TO_VIEW}</ErrorPlaceHolder>;
  }

  return (
    <PageContainerV1>
      <div className="entity-details-container">
        <EntityPageInfo
          canDelete={dataModelPermissions.Delete}
          currentOwner={owner}
          deleted={deleted}
          entityFieldTasks={getEntityFieldThreadCounts(
            EntityField.TAGS,
            entityFieldTaskCount
          )}
          entityFieldThreads={getEntityFieldThreadCounts(
            EntityField.TAGS,
            entityFieldThreadCount
          )}
          entityFqn={dashboardDataModelFQN}
          entityId={entityId}
          entityName={entityName || ''}
          entityType={EntityType.DASHBOARD_DATA_MODEL}
          extraInfo={extraInfo}
          followHandler={handleFollowDataModel}
          followers={followers.length}
          followersList={followers}
          isFollowing={isUserFollowing}
          isTagEditable={hasEditTagsPermission}
          removeTier={hasEditTierPermission ? handleRemoveTier : undefined}
          serviceType={dataModelData?.serviceType ?? ''}
          tags={tags}
          tagsHandler={handleUpdateTags}
          tier={tier}
          titleLinks={breadcrumbTitles}
          updateOwner={hasEditOwnerPermission ? handleUpdateOwner : undefined}
          updateTier={hasEditTierPermission ? handleUpdateTier : undefined}
          version={version}
          onThreadLinkSelect={onThreadLinkSelect}
        />
        <Tabs activeKey={tab} className="h-full" onChange={handleTabChange}>
          <Tabs.TabPane
            key={DATA_MODELS_DETAILS_TABS.MODEL}
            tab={
              <span data-testid={DATA_MODELS_DETAILS_TABS.MODEL}>
                {t('label.model')}
              </span>
            }>
            <Card className="h-full">
              <Space className="w-full" direction="vertical" size={8}>
                <Description
                  description={description}
                  entityFqn={dashboardDataModelFQN}
                  entityName={entityName}
                  entityType={EntityType.DASHBOARD_DATA_MODEL}
                  hasEditAccess={hasEditDescriptionPermission}
                  isEdit={isEditDescription}
                  isReadOnly={deleted}
                  owner={owner}
                  onCancel={() => setIsEditDescription(false)}
                  onDescriptionEdit={() => setIsEditDescription(true)}
                  onDescriptionUpdate={handleUpdateDescription}
                />

                <ModelTab
                  data={dataModelData?.columns || []}
                  hasEditDescriptionPermission={hasEditDescriptionPermission}
                  hasEditTagsPermission={hasEditTagsPermission}
                  isReadOnly={Boolean(deleted)}
                  onUpdate={handleUpdateDataModel}
                />
              </Space>
            </Card>
          </Tabs.TabPane>

          <Tabs.TabPane
            key={DATA_MODELS_DETAILS_TABS.ACTIVITY}
            tab={
              <span data-testid={DATA_MODELS_DETAILS_TABS.ACTIVITY}>
                {t('label.activity-feed-and-task-plural')}{' '}
                {getCountBadge(
                  feedCount,
                  '',
                  DATA_MODELS_DETAILS_TABS.ACTIVITY === tab
                )}
              </span>
            }>
            <Card className="m-y-md">
              <Row justify="center">
                <Col span={18}>
                  <div id="activityfeed">
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
                  </div>
                </Col>
              </Row>
            </Card>
          </Tabs.TabPane>
          {dataModelData?.sql && (
            <Tabs.TabPane
              key={DATA_MODELS_DETAILS_TABS.SQL}
              tab={
                <span data-testid={DATA_MODELS_DETAILS_TABS.SQL}>
                  {t('label.sql-uppercase')}
                </span>
              }>
              <Card className="h-full">
                <SchemaEditor
                  editorClass="custom-code-mirror-theme full-screen-editor-height"
                  mode={{ name: CSMode.SQL }}
                  options={{
                    styleActiveLine: false,
                    readOnly: 'nocursor',
                  }}
                  value={dataModelData.sql}
                />
              </Card>
            </Tabs.TabPane>
          )}

          <Tabs.TabPane
            key={DATA_MODELS_DETAILS_TABS.LINEAGE}
            tab={
              <span data-testid={DATA_MODELS_DETAILS_TABS.LINEAGE}>
                {t('label.lineage')}
              </span>
            }>
            <Card
              className="h-full card-body-full"
              data-testid="lineage-details">
              <EntityLineageComponent
                deleted={deleted}
                entityType={EntityType.DASHBOARD_DATA_MODEL}
                hasEditAccess={hasEditLineagePermission}
              />
            </Card>
          </Tabs.TabPane>
        </Tabs>

        {threadLink ? (
          <ActivityThreadPanel
            createThread={createThread}
            deletePostHandler={deletePostHandler}
            open={Boolean(threadLink)}
            postFeedHandler={postFeedHandler}
            threadLink={threadLink}
            updateThreadHandler={updateThreadHandler}
            onCancel={onThreadPanelClose}
          />
        ) : null}
      </div>
    </PageContainerV1>
  );
};

export default DataModelsPage;
