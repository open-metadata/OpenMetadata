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
import {
  EntityTags,
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
import { getLineageByFQN } from '../../axiosAPIs/lineageAPI';
import { addLineage, deleteLineageEdge } from '../../axiosAPIs/miscAPI';
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
import { EntityType } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { User } from '../../generated/entity/teams/user';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { TagLabel } from '../../generated/type/tagLabel';
import useToastContext from '../../hooks/useToastContext';
import { addToRecentViewed, getCurrentUserId } from '../../utils/CommonUtils';
import {
  dashboardDetailsTabs,
  getCurrentDashboardTab,
} from '../../utils/DashboardDetailsUtils';
import { getEntityLineage } from '../../utils/EntityUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import {
  getOwnerFromId,
  getTagsWithoutTier,
  getTierTags,
} from '../../utils/TableUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
type ChartType = {
  displayName: string;
} & Chart;

const DashboardDetailsPage = () => {
  const USERId = getCurrentUserId();
  const history = useHistory();
  const showToast = useToastContext();
  const [tagList, setTagList] = useState<Array<string>>([]);
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
  const [isLineageLoading, setIsLineageLoading] = useState<boolean>(true);
  const [leafNodes, setLeafNodes] = useState<LeafNodes>({} as LeafNodes);
  const [isNodeLoading, setNodeLoading] = useState<LoadingNodeState>({
    id: undefined,
    state: false,
  });
  const [currentVersion, setCurrentVersion] = useState<string>();
  const [deleted, setDeleted] = useState<boolean>(false);

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

  const fetchTags = () => {
    getTagCategories().then((res) => {
      if (res.data) {
        setTagList(getTaglist(res.data));
      }
    });
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
    getDashboardByFqn(dashboardFQN, [
      'owner',
      'followers',
      'tags',
      'usageSummary',
      'charts',
    ])
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
        setOwner(getOwnerFromId(owner?.id));
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
                  serviceType,
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
          entityType: EntityType.DASHBOARD,
          fqn: fullyQualifiedName,
          serviceType: serviceType,
          timestamp: 0,
        });

        if (!deleted) {
          getLineageData();
        } else {
          setIsLineageLoading(false);
        }

        setDashboardUrl(dashboardUrl);
        fetchCharts(charts).then((charts) => setCharts(charts));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const descriptionUpdateHandler = (updatedDashboard: Dashboard) => {
    saveUpdatedDashboardData(updatedDashboard).then((res: AxiosResponse) => {
      const { description, version } = res.data;
      setCurrentVersion(version);
      setDashboardDetails(res.data);
      setDescription(description);
    });
  };

  const followDashboard = () => {
    addFollower(dashboardId, USERId).then((res: AxiosResponse) => {
      const { newValue } = res.data.changeDescription.fieldsAdded[0];

      setFollowers([...followers, ...newValue]);
    });
  };
  const unfollowDashboard = () => {
    removeFollower(dashboardId, USERId).then((res: AxiosResponse) => {
      const { oldValue } = res.data.changeDescription.fieldsDeleted[0];

      setFollowers(
        followers.filter((follower) => follower.id !== oldValue[0].id)
      );
    });
  };

  const onTagUpdate = (updatedDashboard: Dashboard) => {
    saveUpdatedDashboardData(updatedDashboard).then((res: AxiosResponse) => {
      setTier(getTierTags(res.data.tags));
      setCurrentVersion(res.data.version);
      setTags(getTagsWithoutTier(res.data.tags));
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
          setOwner(getOwnerFromId(res.data.owner?.id));
          setTier(getTierTags(res.data.tags));
          resolve();
        })
        .catch(() => reject());
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

  useEffect(() => {
    fetchDashboardDetail(dashboardFQN);
  }, [dashboardFQN]);

  useEffect(() => {
    fetchTags();
  }, []);

  return (
    <>
      {isLoading || isLineageLoading ? (
        <Loader />
      ) : (
        <DashboardDetails
          activeTab={activeTab}
          addLineageHandler={addLineageHandler}
          chartDescriptionUpdateHandler={onChartUpdate}
          chartTagUpdateHandler={handleChartTagSelection}
          charts={charts}
          dashboardDetails={dashboardDetails}
          dashboardTags={tags}
          dashboardUrl={dashboardUrl}
          deleted={deleted}
          description={description}
          descriptionUpdateHandler={descriptionUpdateHandler}
          entityLineage={entityLineage}
          entityName={displayName}
          followDashboardHandler={followDashboard}
          followers={followers}
          isNodeLoading={isNodeLoading}
          lineageLeafNodes={leafNodes}
          loadNodeHandler={loadNodeHandler}
          owner={owner}
          removeLineageHandler={removeLineageHandler}
          serviceType={serviceType}
          setActiveTabHandler={activeTabHandler}
          settingsUpdateHandler={settingsUpdateHandler}
          slashedDashboardName={slashedDashboardName}
          tagList={tagList}
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
