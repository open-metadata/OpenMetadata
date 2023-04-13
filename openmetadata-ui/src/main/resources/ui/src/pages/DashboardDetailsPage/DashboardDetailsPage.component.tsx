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
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import DashboardDetails from 'components/DashboardDetails/DashboardDetails.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
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
import { getServiceByFQN } from 'rest/serviceAPI';
import AppState from '../../AppState';
import {
  getDashboardDetailsPath,
  getServiceDetailsPath,
  getVersionPath,
} from '../../constants/constants';
import { NO_PERMISSION_TO_VIEW } from '../../constants/HelperTextUtil';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Post, Thread, ThreadType } from '../../generated/entity/feed/thread';
import { Connection } from '../../generated/entity/services/dashboardService';
import { Paging } from '../../generated/type/paging';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
  getFeedCounts,
} from '../../utils/CommonUtils';
import {
  dashboardDetailsTabs,
  defaultFields,
  fetchCharts,
  getCurrentDashboardTab,
  sortTagsForCharts,
} from '../../utils/DashboardDetailsUtils';
import { getEntityFeedLink, getEntityName } from '../../utils/EntityUtils';
import { deletePost, updateThreadData } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export type ChartType = {
  displayName: string;
} & Chart;

const DashboardDetailsPage = () => {
  const { t } = useTranslation();
  const USERId = getCurrentUserId();
  const history = useHistory();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { dashboardFQN, tab } = useParams() as Record<string, string>;
  const [dashboardDetails, setDashboardDetails] = useState<Dashboard>(
    {} as Dashboard
  );
  const [isLoading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<number>(
    getCurrentDashboardTab(tab)
  );
  const [charts, setCharts] = useState<ChartType[]>([]);
  const [dashboardUrl, setDashboardUrl] = useState<string>('');

  const [slashedDashboardName, setSlashedDashboardName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

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

  const activeTabHandler = (tabValue: number) => {
    const currentTabIndex = tabValue - 1;
    if (dashboardDetailsTabs[currentTabIndex].path !== tab) {
      setActiveTab(
        getCurrentDashboardTab(dashboardDetailsTabs[currentTabIndex].path)
      );
      history.push({
        pathname: getDashboardDetailsPath(
          dashboardFQN,
          dashboardDetailsTabs[currentTabIndex].path
        ),
      });
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
    !after && setEntityThread([]);

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
      setEntityThread((prevData) => [...prevData, ...data]);
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

  const fetchServiceDetails = async (type: string, fqn: string) => {
    return new Promise<string>((resolve, reject) => {
      getServiceByFQN(type + 's', fqn, ['owner'])
        .then((resService) => {
          if (resService) {
            const hostPort =
              (resService.connection?.config as Connection)?.hostPort || '';
            resolve(hostPort);
          } else {
            throw null;
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            t('server.entity-details-fetch-error', {
              entityType: t('label.dashboard'),
              entityName: fqn,
            })
          );
          reject(err);
        });
    });
  };

  const fetchDashboardDetail = async (dashboardFQN: string) => {
    setLoading(true);

    try {
      const res = await getDashboardByFqn(dashboardFQN, defaultFields);

      const {
        id,
        fullyQualifiedName,
        service,
        charts: ChartIds,
        dashboardUrl,
        serviceType,
      } = res;
      setDashboardDetails(res);
      setSlashedDashboardName([
        {
          name: service.name ?? '',
          url: service.name
            ? getServiceDetailsPath(
                service.name,
                ServiceCategory.DASHBOARD_SERVICES
              )
            : '',
          imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
        },
        {
          name: getEntityName(res),
          url: '',
          activeTitle: true,
        },
      ]);

      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.DASHBOARD,
        fqn: fullyQualifiedName ?? '',
        serviceType: serviceType,
        timestamp: 0,
        id: id,
      });

      fetchServiceDetails(service.type, service.name ?? '')
        .then((hostPort: string) => {
          setDashboardUrl(hostPort + dashboardUrl);
          fetchCharts(ChartIds)
            .then((chart) => {
              const updatedCharts = (chart as ChartType[]).map((chartItem) => ({
                ...chartItem,
                chartUrl: hostPort + chartItem.chartUrl,
              }));
              setCharts(updatedCharts);
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
        })
        .catch((err: AxiosError) => {
          throw err;
        });
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
    }

    setLoading(false);
  };

  const descriptionUpdateHandler = async (updatedDashboard: Dashboard) => {
    try {
      const response = await saveUpdatedDashboardData(updatedDashboard);
      setDashboardDetails(response);
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

  const onTagUpdate = async (updatedDashboard: Dashboard) => {
    try {
      const res = await saveUpdatedDashboardData(updatedDashboard);
      setDashboardDetails(res);
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: t('label.tag-plural'),
        })
      );
    }
  };

  const settingsUpdateHandler = async (
    updatedDashboard: Dashboard
  ): Promise<void> => {
    try {
      const res = await saveUpdatedDashboardData(updatedDashboard);
      setDashboardDetails(res);
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        t('server.entity-updating-error', {
          entity: getEntityName(updatedDashboard),
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
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => {
    try {
      const res = await updateChart(chartId, patch);

      setCharts((prevCharts) => {
        const charts = [...prevCharts];
        charts[index] = res;

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

  const handleExtensionUpdate = async (updatedDashboard: Dashboard) => {
    try {
      const data = await saveUpdatedDashboardData(updatedDashboard);
      setDashboardDetails(data);
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: dashboardDetails.name,
        })
      );
    }
  };

  useEffect(() => {
    if (
      dashboardDetailsTabs[activeTab - 1].field ===
      TabSpecificField.ACTIVITY_FEED
    ) {
      getFeedData();
    }
  }, [activeTab, feedCount]);

  useEffect(() => {
    if (dashboardPermissions.ViewAll || dashboardPermissions.ViewBasic) {
      fetchDashboardDetail(dashboardFQN);
      getEntityFeedCount();
    }
  }, [dashboardFQN, dashboardPermissions]);

  useEffect(() => {
    fetchResourcePermission(dashboardFQN);
  }, [dashboardFQN]);

  useEffect(() => {
    if (dashboardDetailsTabs[activeTab - 1].path !== tab) {
      setActiveTab(getCurrentDashboardTab(tab));
    }
    setEntityThread([]);
  }, [tab]);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <ErrorPlaceHolder>
          {getEntityMissingError('dashboard', dashboardFQN)}
        </ErrorPlaceHolder>
      ) : (
        <>
          {dashboardPermissions.ViewAll || dashboardPermissions.ViewBasic ? (
            <DashboardDetails
              activeTab={activeTab}
              chartDescriptionUpdateHandler={onChartUpdate}
              chartTagUpdateHandler={handleChartTagSelection}
              charts={charts}
              createThread={createThread}
              dashboardDetails={dashboardDetails}
              dashboardFQN={dashboardFQN}
              dashboardUrl={dashboardUrl}
              deletePostHandler={deletePostHandler}
              descriptionUpdateHandler={descriptionUpdateHandler}
              entityFieldTaskCount={entityFieldTaskCount}
              entityFieldThreadCount={entityFieldThreadCount}
              entityThread={entityThread}
              feedCount={feedCount}
              fetchFeedHandler={getFeedData}
              followDashboardHandler={followDashboard}
              isEntityThreadLoading={isEntityThreadLoading}
              paging={paging}
              postFeedHandler={postFeedHandler}
              setActiveTabHandler={activeTabHandler}
              settingsUpdateHandler={settingsUpdateHandler}
              slashedDashboardName={slashedDashboardName}
              tagUpdateHandler={onTagUpdate}
              unfollowDashboardHandler={unFollowDashboard}
              updateThreadHandler={updateThreadHandler}
              versionHandler={versionHandler}
              onExtensionUpdate={handleExtensionUpdate}
            />
          ) : (
            <ErrorPlaceHolder>{NO_PERMISSION_TO_VIEW}</ErrorPlaceHolder>
          )}
        </>
      )}
    </>
  );
};

export default DashboardDetailsPage;
