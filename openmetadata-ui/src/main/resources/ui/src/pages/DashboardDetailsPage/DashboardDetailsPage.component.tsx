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
  LeafNodes,
  LineagePos,
  LoadingNodeState,
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
  postFeedById,
  postThread,
} from '../../axiosAPIs/feedsAPI';
import { getLineageByFQN } from '../../axiosAPIs/lineageAPI';
import { addLineage, deleteLineageEdge } from '../../axiosAPIs/miscAPI';
import { getServiceByFQN } from '../../axiosAPIs/serviceAPI';
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
import { FeedFilter } from '../../enums/mydata.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Thread, ThreadType } from '../../generated/entity/feed/thread';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import jsonData from '../../jsons/en';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
  getEntityName,
  getFeedCounts,
} from '../../utils/CommonUtils';
import {
  dashboardDetailsTabs,
  defaultFields,
  getCurrentDashboardTab,
} from '../../utils/DashboardDetailsUtils';
import { getEntityFeedLink, getEntityLineage } from '../../utils/EntityUtils';
import {
  deletePost,
  getUpdatedThread,
  updateThreadData,
} from '../../utils/FeedUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

type ChartType = {
  displayName: string;
} & Chart;

const DashboardDetailsPage = () => {
  const USERId = getCurrentUserId();
  const history = useHistory();
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

  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [isentityThreadLoading, setIsentityThreadLoading] =
    useState<boolean>(false);
  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [entityFieldTaskCount, setEntityFieldTaskCount] = useState<
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
    setIsentityThreadLoading(true);
    !after && setEntityThread([]);
    getAllFeeds(
      getEntityFeedLink(EntityType.DASHBOARD, dashboardFQN),
      after,
      threadType,
      feedFilter
    )
      .then((res: AxiosResponse) => {
        const { data, paging: pagingObj } = res.data;
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
          showErrorToast(
            err,
            jsonData['api-error-messages']['fetch-chart-error']
          );
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
    getLineageByFQN(node.fullyQualifiedName, node.type)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setLeafNode(res.data, pos);
          setEntityLineage(getEntityLineage(entityLineage, res.data, pos));
        } else {
          showErrorToast(
            jsonData['api-error-messages']['fetch-lineage-node-error']
          );
        }
        setTimeout(() => {
          setNodeLoading((prev) => ({ ...prev, state: false }));
        }, 500);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-lineage-node-error']
        );
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
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-lineage-error']
        );
      })
      .finally(() => {
        setIsLineageLoading(false);
      });
  };

  const fetchServiceDetails = (type: string, fqn: string) => {
    return new Promise<string>((resolve, reject) => {
      getServiceByFQN(type + 's', fqn, ['owner'])
        .then((resService: AxiosResponse) => {
          if (resService?.data) {
            const hostPort = resService.data.connection?.config?.hostPort || '';
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
            name,
            charts: ChartIds,
            dashboardUrl,
            serviceType,
            version,
          } = res.data;
          setDisplayName(displayName || name);
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
              name: getEntityName(res.data),
              url: '',
              activeTitle: true,
            },
          ]);

          addToRecentViewed({
            displayName: getEntityName(res.data),
            entityType: EntityType.DASHBOARD,
            fqn: fullyQualifiedName,
            serviceType: serviceType,
            timestamp: 0,
          });

          fetchServiceDetails(service.type, service.name)
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
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-description-error']
        );
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
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-follow-error']
        );
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
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-unfollow-error']
        );
      });
  };

  const onTagUpdate = (updatedDashboard: Dashboard) => {
    saveUpdatedDashboardData(updatedDashboard)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setDashboardDetails(res.data);
          setTier(getTierTags(res.data.tags));
          setCurrentVersion(res.data.version);
          setTags(getTagsWithoutTier(res.data.tags));
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
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-entity-error']
          );
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
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-chart-error']
        );
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

  const addLineageHandler = (edge: Edge): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      addLineage(edge)
        .then(() => {
          resolve();
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['add-lineage-error']
          );
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
      showErrorToast(
        err,
        jsonData['api-error-messages']['delete-lineage-error']
      );
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
        showErrorToast(err, jsonData['api-error-messages']['add-feed-error']);
      });
  };

  const createThread = (data: CreateThread) => {
    postThread(data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setEntityThread((pre) => [...pre, res.data]);
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
                      posts: data.posts && data.posts.slice(-3),
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
            showErrorToast(
              error,
              jsonData['api-error-messages']['fetch-updated-conversation-error']
            );
          });
      })
      .catch((error: AxiosError) => {
        showErrorToast(
          error,
          jsonData['api-error-messages']['delete-message-error']
        );
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

  const handleExtentionUpdate = async (updatedDashboard: Dashboard) => {
    try {
      const { data } = await saveUpdatedDashboardData(updatedDashboard);

      if (data) {
        const { version, owner: ownerValue, tags } = data;
        setCurrentVersion(version);
        setDashboardDetails(data);
        setOwner(ownerValue);
        setTier(getTierTags(tags));
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
          entityFieldTaskCount={entityFieldTaskCount}
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
          owner={owner as EntityReference}
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
          updateThreadHandler={updateThreadHandler}
          version={currentVersion as string}
          versionHandler={versionHandler}
          onExtensionUpdate={handleExtentionUpdate}
        />
      )}
    </>
  );
};

export default DashboardDetailsPage;
