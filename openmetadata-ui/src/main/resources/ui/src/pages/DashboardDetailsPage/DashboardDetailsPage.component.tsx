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
import { TagLabel } from '../../generated/type/tagLabel';
import useToastContext from '../../hooks/useToastContext';
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
import { serviceTypeLogo } from '../../utils/ServiceUtils';
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
    getFeedCount(getEntityFeedLink(EntityType.DASHBOARD, dashboardFQN)).then(
      (res: AxiosResponse) => {
        setFeedCount(res.data.totalCount);
        setEntityFieldThreadCount(res.data.counts);
      }
    );
  };

  useEffect(() => {
    if (dashboardDetailsTabs[activeTab - 1].path !== tab) {
      setActiveTab(getCurrentDashboardTab(tab));
    }
  }, [tab]);

  const saveUpdatedDashboardData = (
    updatedData: Dashboard
  ): Promise<AxiosResponse> => {
    const jsonPatch = compare(DashboardDetails, updatedData);

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
      await Promise.allSettled(promiseArr).then(
        (res: PromiseSettledResult<AxiosResponse>[]) => {
          if (res.length) {
            chartsData = res
              .filter((chart) => chart.status === 'fulfilled')
              .map(
                (chart) =>
                  (chart as PromiseFulfilledResult<AxiosResponse>).value.data
              );
          }
        }
      );
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
        setEntityLineage(res.data);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.message ?? 'Error while fetching lineage data',
        });
      })
      .finally(() => {
        setIsLineageLoading(false);
      });
  };

  const fetchDashboardDetail = (dashboardFQN: string) => {
    setLoading(true);
    getDashboardByFqn(dashboardFQN, defaultFields)
      .then((res: AxiosResponse) => {
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
          charts,
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
        fetchCharts(charts).then((charts) => setCharts(charts));
      })
      .catch((err: AxiosError) => {
        if (err.response?.status === 404) {
          setIsError(true);
        } else {
          const errMsg =
            err.message || 'Error while fetching dashboard details';
          showToast({
            variant: 'error',
            body: errMsg,
          });
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
        setIsentityThreadLoading(true);
        getAllFeeds(getEntityFeedLink(EntityType.DASHBOARD, dashboardFQN))
          .then((res: AxiosResponse) => {
            const { data } = res.data;
            setEntityThread(data);
          })
          .catch(() => {
            showToast({
              variant: 'error',
              body: 'Error while fetching entity feeds',
            });
          })
          .finally(() => setIsentityThreadLoading(false));

        break;
      }

      default:
        break;
    }
  };

  const descriptionUpdateHandler = (updatedDashboard: Dashboard) => {
    saveUpdatedDashboardData(updatedDashboard)
      .then((res: AxiosResponse) => {
        const { description, version } = res.data;
        setCurrentVersion(version);
        setDashboardDetails(res.data);
        setDescription(description);
        getEntityFeedCount();
      })
      .catch((err: AxiosError) => {
        const errMsg =
          err.response?.data.message || 'Error while updating description.';
        showToast({
          variant: 'error',
          body: errMsg,
        });
      });
  };

  const followDashboard = () => {
    addFollower(dashboardId, USERId)
      .then((res: AxiosResponse) => {
        const { newValue } = res.data.changeDescription.fieldsAdded[0];

        setFollowers([...followers, ...newValue]);
      })
      .catch((err: AxiosError) => {
        const errMsg =
          err.response?.data.message ||
          'Error while following dashboard entity.';
        showToast({
          variant: 'error',
          body: errMsg,
        });
      });
  };
  const unfollowDashboard = () => {
    removeFollower(dashboardId, USERId)
      .then((res: AxiosResponse) => {
        const { oldValue } = res.data.changeDescription.fieldsDeleted[0];

        setFollowers(
          followers.filter((follower) => follower.id !== oldValue[0].id)
        );
      })
      .catch((err: AxiosError) => {
        const errMsg =
          err.response?.data.message ||
          'Error while unfollowing dashboard entity.';
        showToast({
          variant: 'error',
          body: errMsg,
        });
      });
  };

  const onTagUpdate = (updatedDashboard: Dashboard) => {
    saveUpdatedDashboardData(updatedDashboard)
      .then((res: AxiosResponse) => {
        setTier(getTierTags(res.data.tags));
        setCurrentVersion(res.data.version);
        setTags(getTagsWithoutTier(res.data.tags));
        getEntityFeedCount();
      })
      .catch((err: AxiosError) => {
        const errMsg =
          err.response?.data.message || 'Error while updating tags.';
        showToast({
          variant: 'error',
          body: errMsg,
        });
      });
  };

  const settingsUpdateHandler = (
    updatedDashboard: Dashboard
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      saveUpdatedDashboardData(updatedDashboard)
        .then((res) => {
          setDashboardDetails(res.data);
          setCurrentVersion(res.data.version);
          setOwner(res.data.owner);
          setTier(getTierTags(res.data.tags));
          getEntityFeedCount();
          resolve();
        })
        .catch((err: AxiosError) => {
          const errMsg =
            err.response?.data.message || 'Error while updating entity.';
          reject();
          showToast({
            variant: 'error',
            body: errMsg,
          });
        });
    });
  };

  const onChartUpdate = (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => {
    updateChart(chartId, patch).then((res: AxiosResponse) => {
      if (res.data) {
        setCharts((prevCharts) => {
          const charts = [...prevCharts];
          charts[index] = res.data;

          return charts;
        });
      }
    });
  };

  const handleChartTagSelection = (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => {
    updateChart(chartId, patch).then((res: AxiosResponse) => {
      if (res.data) {
        setCharts((prevCharts) => {
          const charts = [...prevCharts];
          charts[index] = res.data;

          return charts;
        });
      }
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
        .catch(() => {
          showToast({
            variant: 'error',
            body: `Error while adding adding new edge`,
          });
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
    ).catch(() => {
      showToast({
        variant: 'error',
        body: `Error while removing edge`,
      });
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
        }
      })
      .catch(() => {
        showToast({
          variant: 'error',
          body: 'Error while posting feed',
        });
      });
  };

  const createThread = (data: CreateThread) => {
    postThread(data)
      .then((res: AxiosResponse) => {
        setEntityThread((pre) => [...pre, res.data]);
        getEntityFeedCount();
        showToast({
          variant: 'success',
          body: 'Conversation created successfully',
        });
      })
      .catch(() => {
        showToast({
          variant: 'error',
          body: 'Error while creating the conversation',
        });
      });
  };

  useEffect(() => {
    getEntityFeedCount();
  }, []);

  useEffect(() => {
    fetchTabSpecificData(dashboardDetailsTabs[activeTab - 1].field);
  }, [activeTab]);

  useEffect(() => {
    fetchDashboardDetail(dashboardFQN);
    setEntityLineage({} as EntityLineage);
  }, [dashboardFQN]);

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
          deleted={deleted}
          description={description}
          descriptionUpdateHandler={descriptionUpdateHandler}
          entityFieldThreadCount={entityFieldThreadCount}
          entityLineage={entityLineage}
          entityLineageHandler={entityLineageHandler}
          entityName={displayName}
          entityThread={entityThread}
          feedCount={feedCount}
          followDashboardHandler={followDashboard}
          followers={followers}
          isLineageLoading={isLineageLoading}
          isNodeLoading={isNodeLoading}
          isentityThreadLoading={isentityThreadLoading}
          lineageLeafNodes={leafNodes}
          loadNodeHandler={loadNodeHandler}
          owner={owner}
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
