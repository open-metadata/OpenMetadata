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

import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import DashboardDetails from 'components/DashboardDetails/DashboardDetails.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { compare, Operation } from 'fast-json-patch';
import { isUndefined, omitBy, toString } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { updateChart } from 'rest/chartAPI';
import {
  addFollower,
  getDashboardByFqn,
  patchDashboardDetails,
  removeFollower,
} from 'rest/dashboardAPI';
import { getAllFeeds, postFeedById, postThread } from 'rest/feedsAPI';
import AppState from '../../AppState';
import { getVersionPath } from '../../constants/constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Post, Thread, ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
  getFeedCounts,
} from '../../utils/CommonUtils';
import {
  defaultFields,
  fetchCharts,
  sortTagsForCharts,
} from '../../utils/DashboardDetailsUtils';
import { getEntityFeedLink, getEntityName } from '../../utils/EntityUtils';
import { deletePost, updateThreadData } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export type ChartType = {
  displayName: string;
} & Chart;

const DashboardDetailsPage = () => {
  const { t } = useTranslation();
  const USERId = getCurrentUserId();
  const history = useHistory();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { dashboardFQN, tab } =
    useParams<{ dashboardFQN: string; tab: EntityTabs }>();
  const [dashboardDetails, setDashboardDetails] = useState<Dashboard>(
    {} as Dashboard
  );
  const [isLoading, setLoading] = useState<boolean>(false);
  const [charts, setCharts] = useState<ChartType[]>([]);
  const [isError, setIsError] = useState(false);

  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [isEntityThreadLoading, setIsEntityThreadLoading] =
    useState<boolean>(false);
  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [entityFieldTaskCount, setEntityFieldTaskCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [paging, setPaging] = useState<Paging>({} as Paging);

  const [dashboardPermissions, setDashboardPermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { id: dashboardId, version } = dashboardDetails;

  const fetchResourcePermission = async (entityFqn: string) => {
    setLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.DASHBOARD,
        entityFqn
      );
      setDashboardPermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: entityFqn,
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.DASHBOARD,
      dashboardFQN,
      setEntityFieldThreadCount,
      setEntityFieldTaskCount,
      setFeedCount
    );
  };

  const getFeedData = async (
    after?: string,
    feedFilter?: FeedFilter,
    threadType?: ThreadType
  ) => {
    setIsEntityThreadLoading(true);

    try {
      const { data, paging: pagingObj } = await getAllFeeds(
        getEntityFeedLink(EntityType.DASHBOARD, dashboardFQN),
        after,
        threadType,
        feedFilter,
        undefined,
        USERId
      );
      setPaging(pagingObj);
      setEntityThread((prevData) => [...(after ? prevData : []), ...data]);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.entity-feed-plural'),
        })
      );
    } finally {
      setIsEntityThreadLoading(false);
    }
  };

  const saveUpdatedDashboardData = (updatedData: Dashboard) => {
    const jsonPatch = compare(
      omitBy(dashboardDetails, isUndefined),
      updatedData
    );

    return patchDashboardDetails(dashboardId, jsonPatch);
  };

  const fetchDashboardDetail = async (dashboardFQN: string) => {
    setLoading(true);

    try {
      const res = await getDashboardByFqn(dashboardFQN, defaultFields);

      const { id, fullyQualifiedName, charts: ChartIds, serviceType } = res;
      setDashboardDetails(res);

      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.DASHBOARD,
        fqn: fullyQualifiedName ?? '',
        serviceType: serviceType,
        timestamp: 0,
        id: id,
      });

      fetchCharts(ChartIds)
        .then((chart) => {
          setCharts(chart);
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            t('server.entity-fetch-error', {
              entity: t('label.chart-plural'),
            })
          );
        });

      setLoading(false);
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        setIsError(true);
      } else {
        showErrorToast(
          error as AxiosError,
          t('server.entity-details-fetch-error', {
            entityType: t('label.dashboard'),
            entityName: dashboardFQN,
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const onDashboardUpdate = async (
    updatedDashboard: Dashboard,
    key: keyof Dashboard
  ) => {
    try {
      const response = await saveUpdatedDashboardData(updatedDashboard);
      setDashboardDetails((previous) => {
        return {
          ...previous,
          version: response.version,
          [key]: response[key],
        };
      });

      getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const followDashboard = async () => {
    try {
      const res = await addFollower(dashboardId, USERId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      setDashboardDetails((prev) => ({
        ...prev,
        followers: [...(prev?.followers ?? []), ...newValue],
      }));
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(dashboardDetails),
        })
      );
    }
  };

  const unFollowDashboard = async () => {
    try {
      const res = await removeFollower(dashboardId, USERId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];

      setDashboardDetails((prev) => ({
        ...prev,
        followers:
          prev.followers?.filter(
            (follower) => follower.id !== oldValue[0].id
          ) ?? [],
      }));

      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(dashboardDetails),
        })
      );
    }
  };

  const onChartUpdate = async (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => {
    try {
      const response = await updateChart(chartId, patch);
      setCharts((prevCharts) => {
        const charts = [...prevCharts];
        charts[index] = response;

        return charts;
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const handleChartTagSelection = async (
    chartId: string,
    patch: Array<Operation>
  ) => {
    try {
      const res = await updateChart(chartId, patch);

      setCharts((prevCharts) => {
        const charts = [...prevCharts].map((chart) =>
          chart.id === chartId ? res : chart
        );

        // Sorting tags as the response of PATCH request does not return the sorted order
        // of tags, but is stored in sorted manner in the database
        // which leads to wrong PATCH payload sent after further tags removal
        return sortTagsForCharts(charts);
      });
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: t('label.chart-plural'),
        })
      );
    }
  };

  const versionHandler = () => {
    version &&
      history.push(
        getVersionPath(EntityType.DASHBOARD, dashboardFQN, toString(version))
      );
  };

  const postFeedHandler = async (value: string, id: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

    const data = {
      message: value,
      from: currentUser,
    } as Post;

    try {
      const res = await postFeedById(id, data);
      const { id: responseId, posts } = res;
      setEntityThread((pre) => {
        return pre.map((thread) => {
          if (thread.id === responseId) {
            return { ...res, posts: posts?.slice(-3) };
          } else {
            return thread;
          }
        });
      });
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.add-entity-error', {
          entity: t('label.feed-plural'),
        })
      );
    }
  };

  const createThread = async (data: CreateThread) => {
    try {
      const res = await postThread(data);
      setEntityThread((pre) => [...pre, res]);
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

  const deletePostHandler = (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => {
    deletePost(threadId, postId, isThread, setEntityThread);
  };

  const updateThreadHandler = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    updateThreadData(threadId, postId, isThread, data, setEntityThread);
  };

  useEffect(() => {
    if (tab === EntityTabs.ACTIVITY_FEED) {
      getFeedData();
    }
  }, [tab, feedCount]);

  useEffect(() => {
    if (dashboardPermissions.ViewAll || dashboardPermissions.ViewBasic) {
      fetchDashboardDetail(dashboardFQN);
      getEntityFeedCount();
    }
  }, [dashboardFQN, dashboardPermissions]);

  useEffect(() => {
    fetchResourcePermission(dashboardFQN);
  }, [dashboardFQN]);

  if (isLoading) {
    return <Loader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('dashboard', dashboardFQN)}
      </ErrorPlaceHolder>
    );
  }
  if (!dashboardPermissions.ViewAll && !dashboardPermissions.ViewBasic) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <DashboardDetails
      chartDescriptionUpdateHandler={onChartUpdate}
      chartTagUpdateHandler={handleChartTagSelection}
      charts={charts}
      createThread={createThread}
      dashboardDetails={dashboardDetails}
      deletePostHandler={deletePostHandler}
      entityFieldTaskCount={entityFieldTaskCount}
      entityFieldThreadCount={entityFieldThreadCount}
      entityThread={entityThread}
      feedCount={feedCount}
      fetchFeedHandler={getFeedData}
      followDashboardHandler={followDashboard}
      isEntityThreadLoading={isEntityThreadLoading}
      paging={paging}
      postFeedHandler={postFeedHandler}
      unfollowDashboardHandler={unFollowDashboard}
      updateThreadHandler={updateThreadHandler}
      versionHandler={versionHandler}
      onDashboardUpdate={onDashboardUpdate}
    />
  );
};

export default DashboardDetailsPage;
