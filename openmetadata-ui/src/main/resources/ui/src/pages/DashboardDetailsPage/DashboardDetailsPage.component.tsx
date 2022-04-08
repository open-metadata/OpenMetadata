/*
 *  Copyright 2021 Collate
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

import { AxiosError, AxiosPromise, AxiosResponse } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import {
  EntityFieldThreadCount,
  EntityTags,
  EntityThread,
  LeafNodes,
  LineagePos,
  LoadingNodeState,
  TableDetail,
} from 'Models';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { getChartById, updateChart } from '../../axiosAPIs/chartAPI';
import {
  addFollower,
  getDashboardByFqn,
  patchDashboardDetails,
  removeFollower,
} from '../../axiosAPIs/dashboardAPI';
import {
  getAllFeeds,
  getFeedCount,
  postFeedById,
  postThread,
} from '../../axiosAPIs/feedsAPI';
import { getLineageByFQN } from '../../axiosAPIs/lineageAPI';
import { addLineage, deleteLineageEdge } from '../../axiosAPIs/miscAPI';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import DashboardDetails from '../../components/DashboardDetails/DashboardDetails.component';
import {
  Edge,
  EdgeData,
} from '../../components/EntityLineage/EntityLineage.interface';
import Loader from '../../components/Loader/Loader';
import {
  getDashboardDetailsPath,
  getServiceDetailsPath,
  getVersionPath,
} from '../../constants/constants';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { User } from '../../generated/entity/teams/user';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import useToastContext from '../../hooks/useToastContext';
import jsonData from '../../jsons/en';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
} from '../../utils/CommonUtils';
import {
  dashboardDetailsTabs,
  defaultFields,
  getCurrentDashboardTab,
} from '../../utils/DashboardDetailsUtils';
import { getEntityFeedLink, getEntityLineage } from '../../utils/EntityUtils';
import { deletePost, getUpdatedThread } from '../../utils/FeedUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getErrorText } from '../../utils/StringsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';

type ChartType = {
  displayName: string;
} & Chart;

const DashboardDetailsPage = () => {
  const USERId = getCurrentUserId();
  const history = useHistory();
  const showToast = useToastContext();
  const { dashboardFQN, tab } = useParams() as Record<string, string>;
  const [dashboardDetails, setDashboardDetails] = useState<Dashboard>(
    {} as Dashboard
  );
  const [dashboardId, setDashboardId] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [followers, setFollowers] = useState<Array<User>>([]);
  const [owner, setOwner] = useState<TableDetail['owner']>();
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
  const [entityLineage, setEntityLineage] = useState<EntityLineage>(
    {} as EntityLineage
  );
  const [isLineageLoading, setIsLineageLoading] = useState<boolean>(false);
  const [leafNodes, setLeafNodes] = useState<LeafNodes>({} as LeafNodes);
  const [isNodeLoading, setNodeLoading] = useState<LoadingNodeState>({
    id: undefined,
    state: false,
  });
  const [currentVersion, setCurrentVersion] = useState<string>();
  const [deleted, setDeleted] = useState<boolean>(false);
  const [isError, setIsError] = useState(false);

  const [entityThread, setEntityThread] = useState<EntityThread[]>([]);
  const [isentityThreadLoading, setIsentityThreadLoading] =
    useState<boolean>(false);
  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [paging, setPaging] = useState<Paging>({} as Paging);

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

  const handleShowErrorToast = (errMessage: string) => {
    showToast({
      variant: 'error',
      body: errMessage,
    });
  };

  const handleShowSuccessToast = (message: string) => {
    showToast({
      variant: 'success',
      body: message,
    });
  };

  const getEntityFeedCount = () => {
    getFeedCount(getEntityFeedLink(EntityType.DASHBOARD, dashboardFQN))
      .then((res: AxiosResponse) => {
        if (res.data) {
          setFeedCount(res.data.totalCount);
          setEntityFieldThreadCount(res.data.counts);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['fetch-entity-feed-count-error']
        );

        handleShowErrorToast(errMsg);
      });
  };

  const getFeedData = (after?: string) => {
    setIsentityThreadLoading(true);
    getAllFeeds(getEntityFeedLink(EntityType.DASHBOARD, dashboardFQN), after)
      .then((res: AxiosResponse) => {
        const { data, paging: pagingObj } = res.data;
        if (data) {
          setPaging(pagingObj);
          setEntityThread((prevData) => [...prevData, ...data]);
        } else {
          handleShowErrorToast(
            jsonData['api-error-messages']['fetch-entity-feed-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        const errMsg =
          err.response?.data?.message ||
          jsonData['api-error-messages']['fetch-entity-feed-error'];
        handleShowErrorToast(errMsg);
      })
      .finally(() => setIsentityThreadLoading(false));
  };

  const saveUpdatedDashboardData = (
    updatedData: Dashboard
  ): Promise<AxiosResponse> => {
    const jsonPatch = compare(dashboardDetails, updatedData);

    return patchDashboardDetails(
      dashboardId,
      jsonPatch
    ) as unknown as Promise<AxiosResponse>;
  };

  const fetchCharts = async (charts: Dashboard['charts']) => {
    let chartsData: ChartType[] = [];
    let promiseArr: Array<AxiosPromise> = [];
    if (charts?.length) {
      promiseArr = charts.map((chart) => getChartById(chart.id, ['tags']));
      await Promise.allSettled(promiseArr)
        .then((res: PromiseSettledResult<AxiosResponse>[]) => {
          if (res.length) {
            chartsData = res
              .filter((chart) => chart.status === 'fulfilled')
              .map(
                (chart) =>
                  (chart as PromiseFulfilledResult<AxiosResponse>).value.data
              );
          }
        })
        .catch((err: AxiosError) => {
          const errMsg = getErrorText(
            err,
            jsonData['api-error-messages']['fetch-chart-error']
          );
          handleShowErrorToast(errMsg);
        });
    }

    return chartsData;
  };

  const setLeafNode = (val: EntityLineage, pos: LineagePos) => {
    if (pos === 'to' && val.downstreamEdges?.length === 0) {
      setLeafNodes((prev) => ({
        ...prev,
        downStreamNode: [...(prev.downStreamNode ?? []), val.entity.id],
      }));
    }
    if (pos === 'from' && val.upstreamEdges?.length === 0) {
      setLeafNodes((prev) => ({
        ...prev,
        upStreamNode: [...(prev.upStreamNode ?? []), val.entity.id],
      }));
    }
  };

  const entityLineageHandler = (lineage: EntityLineage) => {
    setEntityLineage(lineage);
  };

  const loadNodeHandler = (node: EntityReference, pos: LineagePos) => {
    setNodeLoading({ id: node.id, state: true });
    getLineageByFQN(node.name, node.type).then((res: AxiosResponse) => {
      setLeafNode(res.data, pos);
      setEntityLineage(getEntityLineage(entityLineage, res.data, pos));
      setTimeout(() => {
        setNodeLoading((prev) => ({ ...prev, state: false }));
      }, 500);
    });
  };

  const getLineageData = () => {
    setIsLineageLoading(true);
    getLineageByFQN(dashboardFQN, EntityType.DASHBOARD)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setEntityLineage(res.data);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['fetch-lineage-error']
        );
        handleShowErrorToast(errMsg);
      })
      .finally(() => {
        setIsLineageLoading(false);
      });
  };

  const fetchDashboardDetail = (dashboardFQN: string) => {
    setLoading(true);
    getDashboardByFqn(dashboardFQN, defaultFields)
      .then((res: AxiosResponse) => {
        if (res.data) {
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
            charts: ChartIds,
            dashboardUrl,
            serviceType,
            version,
          } = res.data;
          setDisplayName(displayName);
          setDashboardDetails(res.data);
          setCurrentVersion(version);
          setDashboardId(id);
          setDescription(description ?? '');
          setFollowers(followers);
          setOwner(owner);
          setTier(getTierTags(tags));
          setTags(getTagsWithoutTier(tags));
          setServiceType(serviceType);
          setDeleted(deleted);
          setSlashedDashboardName([
            {
              name: service.name,
              url: service.name
                ? getServiceDetailsPath(
                    service.name,
                    ServiceCategory.DASHBOARD_SERVICES
                  )
                : '',
              imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
            },
            {
              name: displayName,
              url: '',
              activeTitle: true,
            },
          ]);

          addToRecentViewed({
            displayName,
            entityType: EntityType.DASHBOARD,
            fqn: fullyQualifiedName,
            serviceType: serviceType,
            timestamp: 0,
          });

          setDashboardUrl(dashboardUrl);
          fetchCharts(ChartIds)
            .then((chart) => setCharts(chart))
            .catch((error: AxiosError) => {
              const msg = getErrorText(
                error,
                jsonData['api-error-messages']['fetch-chart-error']
              );
              handleShowErrorToast(msg);
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
          const errMsg = getErrorText(
            err,
            jsonData['api-error-messages']['fetch-dashboard-details-error']
          );

          handleShowErrorToast(errMsg);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const fetchTabSpecificData = (tabField = '') => {
    switch (tabField) {
      case TabSpecificField.LINEAGE: {
        if (!deleted) {
          if (isEmpty(entityLineage)) {
            getLineageData();
          }

          break;
        }

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

  const descriptionUpdateHandler = (updatedDashboard: Dashboard) => {
    saveUpdatedDashboardData(updatedDashboard)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { description, version } = res.data;
          setCurrentVersion(version);
          setDashboardDetails(res.data);
          setDescription(description);
          getEntityFeedCount();
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['update-description-error']
        );

        handleShowErrorToast(errMsg);
      });
  };

  const followDashboard = () => {
    addFollower(dashboardId, USERId)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { newValue } = res.data.changeDescription.fieldsAdded[0];

          setFollowers([...followers, ...newValue]);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['update-entity-follow-error']
        );
        handleShowErrorToast(errMsg);
      });
  };

  const unfollowDashboard = () => {
    removeFollower(dashboardId, USERId)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { oldValue } = res.data.changeDescription.fieldsDeleted[0];

          setFollowers(
            followers.filter((follower) => follower.id !== oldValue[0].id)
          );
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['update-entity-unfollow-error']
        );

        handleShowErrorToast(errMsg);
      });
  };

  const onTagUpdate = (updatedDashboard: Dashboard) => {
    saveUpdatedDashboardData(updatedDashboard)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setTier(getTierTags(res.data.tags));
          setCurrentVersion(res.data.version);
          setTags(getTagsWithoutTier(res.data.tags));
          getEntityFeedCount();
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['update-tags-error']
        );

        handleShowErrorToast(errMsg);
      });
  };

  const settingsUpdateHandler = (
    updatedDashboard: Dashboard
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      saveUpdatedDashboardData(updatedDashboard)
        .then((res) => {
          if (res.data) {
            setDashboardDetails(res.data);
            setCurrentVersion(res.data.version);
            setOwner(res.data.owner);
            setTier(getTierTags(res.data.tags));
            getEntityFeedCount();
            resolve();
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          const errMsg = getErrorText(
            err,
            jsonData['api-error-messages']['update-entity-error']
          );
          handleShowErrorToast(errMsg);
          reject();
        });
    });
  };

  const onChartUpdate = (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => {
    updateChart(chartId, patch)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setCharts((prevCharts) => {
            const charts = [...prevCharts];
            charts[index] = res.data;

            return charts;
          });
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['update-chart-error']
        );

        handleShowErrorToast(errMsg);
      });
  };

  const handleChartTagSelection = (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => {
    updateChart(chartId, patch)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setCharts((prevCharts) => {
            const charts = [...prevCharts];
            charts[index] = res.data;

            return charts;
          });
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['update-chart-error']
        );

        handleShowErrorToast(errMsg);
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

  const addLineageHandler = (edge: Edge): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      addLineage(edge)
        .then(() => {
          resolve();
        })
        .catch((err: AxiosError) => {
          const errMsg = getErrorText(
            err,
            jsonData['api-error-messages']['add-lineage-error']
          );
          handleShowErrorToast(errMsg);
          reject();
        });
    });
  };

  const removeLineageHandler = (data: EdgeData) => {
    deleteLineageEdge(
      data.fromEntity,
      data.fromId,
      data.toEntity,
      data.toId
    ).catch((err: AxiosError) => {
      const errMsg = getErrorText(
        err,
        jsonData['api-error-messages']['delete-lineage-error']
      );
      handleShowErrorToast(errMsg);
    });
  };

  const postFeedHandler = (value: string, id: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

    const data = {
      message: value,
      from: currentUser,
    };
    postFeedById(id, data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { id, posts } = res.data;
          setEntityThread((pre) => {
            return pre.map((thread) => {
              if (thread.id === id) {
                return { ...res.data, posts: posts.slice(-3) };
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
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['add-feed-error']
        );

        handleShowErrorToast(errMsg);
      });
  };

  const createThread = (data: CreateThread) => {
    postThread(data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setEntityThread((pre) => [...pre, res.data]);
          getEntityFeedCount();
          handleShowSuccessToast(
            jsonData['api-success-messages']['create-conversation']
          );
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['create-conversation-error']
        );

        handleShowErrorToast(errMsg);
      });
  };

  const deletePostHandler = (threadId: string, postId: string) => {
    deletePost(threadId, postId)
      .then(() => {
        getUpdatedThread(threadId)
          .then((data) => {
            if (data) {
              setEntityThread((pre) => {
                return pre.map((thread) => {
                  if (thread.id === data.id) {
                    return {
                      ...thread,
                      posts: data.posts.slice(-3),
                      postsCount: data.postsCount,
                    };
                  } else {
                    return thread;
                  }
                });
              });
            } else {
              throw jsonData['api-error-messages'][
                'unexpected-server-response'
              ];
            }
          })
          .catch((error: AxiosError) => {
            const errMsg = getErrorText(
              error,
              jsonData['api-error-messages']['fetch-updated-conversation-error']
            );

            handleShowErrorToast(errMsg);
          });

        handleShowSuccessToast(
          jsonData['api-success-messages']['delete-message']
        );
      })
      .catch((error: AxiosError) => {
        const message = getErrorText(
          error,
          jsonData['api-error-messages']['delete-message-error']
        );
        handleShowErrorToast(message);
      });
  };

  useEffect(() => {
    fetchTabSpecificData(dashboardDetailsTabs[activeTab - 1].field);
  }, [activeTab]);

  useEffect(() => {
    fetchDashboardDetail(dashboardFQN);
    setEntityLineage({} as EntityLineage);
    getEntityFeedCount();
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
        <DashboardDetails
          activeTab={activeTab}
          addLineageHandler={addLineageHandler}
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
          entityFieldThreadCount={entityFieldThreadCount}
          entityLineage={entityLineage}
          entityLineageHandler={entityLineageHandler}
          entityName={displayName}
          entityThread={entityThread}
          feedCount={feedCount}
          fetchFeedHandler={getFeedData}
          followDashboardHandler={followDashboard}
          followers={followers}
          isLineageLoading={isLineageLoading}
          isNodeLoading={isNodeLoading}
          isentityThreadLoading={isentityThreadLoading}
          lineageLeafNodes={leafNodes}
          loadNodeHandler={loadNodeHandler}
          owner={owner}
          paging={paging}
          postFeedHandler={postFeedHandler}
          removeLineageHandler={removeLineageHandler}
          serviceType={serviceType}
          setActiveTabHandler={activeTabHandler}
          settingsUpdateHandler={settingsUpdateHandler}
          slashedDashboardName={slashedDashboardName}
          tagUpdateHandler={onTagUpdate}
          tier={tier as TagLabel}
          unfollowDashboardHandler={unfollowDashboard}
          users={AppState.users}
          version={currentVersion as string}
          versionHandler={versionHandler}
        />
      )}
    </>
  );
};

export default DashboardDetailsPage;
