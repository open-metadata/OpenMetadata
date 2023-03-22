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
import { isUndefined, omitBy } from 'lodash';
import { EntityTags } from 'Models';
import React, { useEffect, useState } from 'react';
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
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import jsonData from '../../jsons/en';
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
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export type ChartType = {
  displayName: string;
} & Chart;

const DashboardDetailsPage = () => {
  const USERId = getCurrentUserId();
  const history = useHistory();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { dashboardFQN, tab } = useParams() as Record<string, string>;
  const [dashboardDetails, setDashboardDetails] = useState<Dashboard>(
    {} as Dashboard
  );
  const [dashboardId, setDashboardId] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [followers, setFollowers] = useState<Array<EntityReference>>([]);
  const [owner, setOwner] = useState<EntityReference>();
  const [tier, setTier] = useState<TagLabel>();
  const [tags, setTags] = useState<Array<EntityTags>>([]);
  const [activeTab, setActiveTab] = useState<number>(
    getCurrentDashboardTab(tab)
  );
  const [charts, setCharts] = useState<ChartType[]>([]);
  const [dashboardUrl, setDashboardUrl] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [serviceType, setServiceType] = useState<string>('');
  const [slashedDashboardName, setSlashedDashboardName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [currentVersion, setCurrentVersion] = useState<string>();
  const [deleted, setDeleted] = useState<boolean>(false);
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
        jsonData['api-error-messages']['fetch-entity-permissions-error']
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

  const getFeedData = (
    after?: string,
    feedFilter?: FeedFilter,
    threadType?: ThreadType
  ) => {
    setIsEntityThreadLoading(true);
    !after && setEntityThread([]);
    getAllFeeds(
      getEntityFeedLink(EntityType.DASHBOARD, dashboardFQN),
      after,
      threadType,
      feedFilter,
      undefined,
      USERId
    )
      .then((res) => {
        const { data, paging: pagingObj } = res;
        if (data) {
          setPaging(pagingObj);
          setEntityThread((prevData) => [...prevData, ...data]);
        } else {
          showErrorToast(
            jsonData['api-error-messages']['fetch-entity-feed-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-entity-feed-error']
        );
      })
      .finally(() => setIsEntityThreadLoading(false));
  };

  const saveUpdatedDashboardData = (updatedData: Dashboard) => {
    const jsonPatch = compare(
      omitBy(dashboardDetails, isUndefined),
      updatedData
    );

    return patchDashboardDetails(dashboardId, jsonPatch);
  };

  const fetchServiceDetails = (type: string, fqn: string) => {
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
            jsonData['api-error-messages']['fetch-dashboard-details-error']
          );
          reject(err);
        });
    });
  };

  const fetchDashboardDetail = (dashboardFQN: string) => {
    setLoading(true);
    getDashboardByFqn(dashboardFQN, defaultFields)
      .then((res) => {
        if (res) {
          const {
            id,
            deleted,
            description,
            followers,
            fullyQualifiedName,
            service,
            tags,
            owner,
            displayName,
            name,
            charts: ChartIds,
            dashboardUrl,
            serviceType,
            version,
          } = res;
          setDisplayName(displayName || name);
          setDashboardDetails(res);
          setCurrentVersion(version + '');
          setDashboardId(id);
          setDescription(description ?? '');
          setFollowers(followers ?? []);
          setOwner(owner);
          setTier(getTierTags(tags ?? []));
          setTags(getTagsWithoutTier(tags ?? []));
          setServiceType(serviceType ?? '');
          setDeleted(Boolean(deleted));
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
                  const updatedCharts = (chart as ChartType[]).map(
                    (chartItem) => ({
                      ...chartItem,
                      chartUrl: hostPort + chartItem.chartUrl,
                    })
                  );
                  setCharts(updatedCharts);
                })
                .catch((error: AxiosError) => {
                  showErrorToast(
                    error,
                    jsonData['api-error-messages']['fetch-chart-error']
                  );
                });

              setLoading(false);
            })
            .catch((err: AxiosError) => {
              throw err;
            });
        } else {
          setIsError(true);

          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        if (err.response?.status === 404) {
          setIsError(true);
        } else {
          showErrorToast(
            err,
            jsonData['api-error-messages']['fetch-dashboard-details-error']
          );
        }
        setLoading(false);
      });
  };

  const fetchTabSpecificData = (tabField = '') => {
    switch (tabField) {
      case TabSpecificField.LINEAGE: {
        break;
      }
      case TabSpecificField.ACTIVITY_FEED: {
        getFeedData();

        break;
      }

      default:
        break;
    }
  };

  const descriptionUpdateHandler = async (updatedDashboard: Dashboard) => {
    try {
      const response = await saveUpdatedDashboardData(updatedDashboard);
      if (response) {
        const { description, version } = response;
        setCurrentVersion(version + '');
        setDashboardDetails(response);
        setDescription(description + '');
        getEntityFeedCount();
      } else {
        throw jsonData['api-error-messages']['unexpected-server-response'];
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const followDashboard = () => {
    addFollower(dashboardId, USERId)
      .then((res) => {
        if (res) {
          const { newValue } = res.changeDescription.fieldsAdded[0];

          setFollowers([...followers, ...newValue]);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-follow-error']
        );
      });
  };

  const unfollowDashboard = () => {
    removeFollower(dashboardId, USERId)
      .then((res) => {
        if (res) {
          const { oldValue } = res.changeDescription.fieldsDeleted[0];

          setFollowers(
            followers.filter((follower) => follower.id !== oldValue[0].id)
          );
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-unfollow-error']
        );
      });
  };

  const onTagUpdate = (updatedDashboard: Dashboard) => {
    saveUpdatedDashboardData(updatedDashboard)
      .then((res) => {
        if (res) {
          setDashboardDetails(res);
          setTier(getTierTags(res.tags ?? []));
          setCurrentVersion(res.version + '');
          setTags(getTagsWithoutTier(res.tags ?? []));
          getEntityFeedCount();
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-tags-error']
        );
      });
  };

  const settingsUpdateHandler = (
    updatedDashboard: Dashboard
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      saveUpdatedDashboardData(updatedDashboard)
        .then((res) => {
          if (res) {
            setDashboardDetails({ ...res, tags: res.tags ?? [] });
            setCurrentVersion(res.version + '');
            setOwner(res.owner);
            setTier(getTierTags(res.tags ?? []));
            getEntityFeedCount();
            resolve();
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-entity-error']
          );
          reject();
        });
    });
  };

  const onChartUpdate = async (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => {
    try {
      const response = await updateChart(chartId, patch);
      if (response) {
        setCharts((prevCharts) => {
          const charts = [...prevCharts];
          charts[index] = response;

          return charts;
        });
      } else {
        throw jsonData['api-error-messages']['unexpected-server-response'];
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleChartTagSelection = (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => {
    updateChart(chartId, patch)
      .then((res) => {
        if (res) {
          setCharts((prevCharts) => {
            const charts = [...prevCharts];
            charts[index] = res;

            // Sorting tags as the response of PATCH request does not return the sorted order
            // of tags, but is stored in sorted manner in the database
            // which leads to wrong PATCH payload sent after further tags removal
            return sortTagsForCharts(charts);
          });
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-chart-error']
        );
      });
  };

  const versionHandler = () => {
    history.push(
      getVersionPath(
        EntityType.DASHBOARD,
        dashboardFQN,
        currentVersion as string
      )
    );
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

  const handleExtentionUpdate = async (updatedDashboard: Dashboard) => {
    try {
      const data = await saveUpdatedDashboardData(updatedDashboard);

      if (data) {
        const { version, owner: ownerValue, tags } = data;
        setCurrentVersion(version + '');
        setDashboardDetails(data);
        setOwner(ownerValue);
        setTier(getTierTags(tags ?? []));
      } else {
        throw jsonData['api-error-messages']['update-entity-error'];
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['update-entity-error']
      );
    }
  };

  useEffect(() => {
    fetchTabSpecificData(dashboardDetailsTabs[activeTab - 1].field);
  }, [activeTab]);

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
              dashboardTags={tags}
              dashboardUrl={dashboardUrl}
              deletePostHandler={deletePostHandler}
              deleted={deleted}
              description={description}
              descriptionUpdateHandler={descriptionUpdateHandler}
              entityFieldTaskCount={entityFieldTaskCount}
              entityFieldThreadCount={entityFieldThreadCount}
              entityName={displayName}
              entityThread={entityThread}
              feedCount={feedCount}
              fetchFeedHandler={getFeedData}
              followDashboardHandler={followDashboard}
              followers={followers}
              isEntityThreadLoading={isEntityThreadLoading}
              owner={owner as EntityReference}
              paging={paging}
              postFeedHandler={postFeedHandler}
              serviceType={serviceType}
              setActiveTabHandler={activeTabHandler}
              settingsUpdateHandler={settingsUpdateHandler}
              slashedDashboardName={slashedDashboardName}
              tagUpdateHandler={onTagUpdate}
              tier={tier as TagLabel}
              unfollowDashboardHandler={unfollowDashboard}
              updateThreadHandler={updateThreadHandler}
              version={currentVersion as string}
              versionHandler={versionHandler}
              onExtensionUpdate={handleExtentionUpdate}
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
