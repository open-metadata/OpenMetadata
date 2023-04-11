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

import AppState from 'AppState';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import DataModelDetails from 'components/DataModels/DataModelDetails.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import { NO_PERMISSION_TO_VIEW } from 'constants/HelperTextUtil';
import { EntityType } from 'enums/entity.enum';
import { FeedFilter } from 'enums/mydata.enum';
import { compare, Operation } from 'fast-json-patch';
import { CreateThread } from 'generated/api/feed/createThread';
import { DashboardDataModel } from 'generated/entity/data/dashboardDataModel';
import { Post, Thread, ThreadType } from 'generated/entity/feed/thread';
import { Paging } from 'generated/type/paging';
import { LabelType, State, TagSource } from 'generated/type/tagLabel';
import { EntityFieldThreadCount } from 'interface/feed.interface';
import jsonData from 'jsons/en';
import { isUndefined, omitBy } from 'lodash';
import { observer } from 'mobx-react';
import { EntityTags } from 'Models';
import {
  default as React,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  getCurrentUserId,
  getEntityMissingError,
  getFeedCounts,
} from 'utils/CommonUtils';
import {
  getDataModelsDetailPath,
  getSortedDataModelColumnTags,
} from 'utils/DataModelsUtils';
import { getEntityFeedLink } from 'utils/EntityUtils';
import { deletePost, updateThreadData } from 'utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from 'utils/TableUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { DATA_MODELS_DETAILS_TABS } from './DataModelsInterface';

const DataModelsPage = () => {
  const history = useHistory();
  const { t } = useTranslation();

  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { dashboardDataModelFQN, tab } = useParams() as Record<string, string>;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [dataModelPermissions, setDataModelPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [dataModelData, setDataModelData] = useState<DashboardDataModel>();

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

  const { hasViewPermission } = useMemo(() => {
    return {
      hasViewPermission:
        dataModelPermissions.ViewAll || dataModelPermissions.ViewBasic,
    };
  }, [dataModelPermissions]);

  const { tier, isUserFollowing } = useMemo(() => {
    return {
      tier: getTierTags(dataModelData?.tags ?? []),
      isUserFollowing: dataModelData?.followers?.some(
        ({ id }: { id: string }) => id === getCurrentUserId()
      ),
    };
  }, [dataModelData]);

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
      getEntityFeedCount();
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

  const handleColumnUpdateDataModel = async (
    updatedDataModel: DashboardDataModel['columns']
  ) => {
    try {
      const { columns: newColumns, version } = await handleUpdateDataModelData({
        ...(dataModelData as DashboardDataModel),
        columns: updatedDataModel,
      });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        columns: getSortedDataModelColumnTags(newColumns),
        version,
      }));
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    if (tab === DATA_MODELS_DETAILS_TABS.ACTIVITY) {
      getFeedData();
    }
  }, [tab, feedCount, dashboardDataModelFQN]);

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
    <DataModelDetails
      activeTab={tab}
      createThread={createThread}
      dashboardDataModelFQN={dashboardDataModelFQN}
      dataModelData={dataModelData}
      dataModelPermissions={dataModelPermissions}
      deletePostHandler={deletePostHandler}
      entityFieldTaskCount={entityFieldTaskCount}
      entityFieldThreadCount={entityFieldThreadCount}
      entityThread={entityThread}
      feedCount={feedCount}
      fetchFeedHandler={getFeedData}
      handleFeedFilterChange={handleFeedFilterChange}
      handleFollowDataModel={handleFollowDataModel}
      handleRemoveTier={handleRemoveTier}
      handleTabChange={handleTabChange}
      handleUpdateDataModel={handleColumnUpdateDataModel}
      handleUpdateDescription={handleUpdateDescription}
      handleUpdateOwner={handleUpdateOwner}
      handleUpdateTags={handleUpdateTags}
      handleUpdateTier={handleUpdateTier}
      isEntityThreadLoading={isEntityThreadLoading}
      paging={paging}
      postFeedHandler={postFeedHandler}
      updateThreadHandler={updateThreadHandler}
    />
  );
};

export default observer(DataModelsPage);
