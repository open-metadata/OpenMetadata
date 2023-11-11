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
import { compare, Operation } from 'fast-json-patch';
import { isUndefined, omitBy, toString } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { useAuthContext } from '../../components/Auth/AuthProviders/AuthProvider';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import DashboardDetails from '../../components/DashboardDetails/DashboardDetails.component';
import Loader from '../../components/Loader/Loader';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../components/PermissionProvider/PermissionProvider.interface';
import { QueryVote } from '../../components/TableQueries/TableQueries.interface';
import { getVersionPath } from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { updateChart } from '../../rest/chartAPI';
import {
  addFollower,
  getDashboardByFqn,
  patchDashboardDetails,
  removeFollower,
  updateDashboardVotes,
} from '../../rest/dashboardAPI';
import { postThread } from '../../rest/feedsAPI';
import {
  addToRecentViewed,
  getEntityMissingError,
  sortTagsCaseInsensitive,
} from '../../utils/CommonUtils';
import {
  defaultFields,
  fetchCharts,
  sortTagsForCharts,
} from '../../utils/DashboardDetailsUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export type ChartType = {
  displayName: string;
} & Chart;

const DashboardDetailsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuthContext();
  const USERId = currentUser?.id ?? '';
  const history = useHistory();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { fqn: dashboardFQN } = useParams<{ fqn: string }>();
  const [dashboardDetails, setDashboardDetails] = useState<Dashboard>(
    {} as Dashboard
  );
  const [isLoading, setLoading] = useState<boolean>(false);
  const [charts, setCharts] = useState<ChartType[]>([]);
  const [isError, setIsError] = useState(false);

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

  const saveUpdatedDashboardData = (updatedData: Dashboard) => {
    const jsonPatch = compare(
      omitBy(dashboardDetails, isUndefined),
      updatedData
    );

    return patchDashboardDetails(dashboardId, jsonPatch);
  };

  const viewUsagePermission = useMemo(
    () => dashboardPermissions.ViewAll || dashboardPermissions.ViewUsage,
    [dashboardPermissions]
  );

  const fetchDashboardDetail = async (dashboardFQN: string) => {
    setLoading(true);

    try {
      let fields = defaultFields;
      if (viewUsagePermission) {
        fields += `,${TabSpecificField.USAGE_SUMMARY}`;
      }
      const res = await getDashboardByFqn(dashboardFQN, fields);

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
          [key]:
            key === 'tags'
              ? sortTagsCaseInsensitive(response[key] ?? [])
              : response[key],
        };
      });
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

  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };

  const handleToggleDelete = () => {
    setDashboardDetails((prev) => {
      if (!prev) {
        return prev;
      }

      return { ...prev, deleted: !prev?.deleted };
    });
  };

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateDashboardVotes(id, data);
      const details = await getDashboardByFqn(dashboardFQN, defaultFields);
      setDashboardDetails(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateDashboardDetailsState = useCallback((data) => {
    const updatedData = data as Dashboard;

    setDashboardDetails((data) => ({
      ...(data ?? updatedData),
      version: updatedData.version,
    }));
  }, []);

  useEffect(() => {
    if (dashboardPermissions.ViewAll || dashboardPermissions.ViewBasic) {
      fetchDashboardDetail(dashboardFQN);
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
      fetchDashboard={() => fetchDashboardDetail(dashboardFQN)}
      followDashboardHandler={followDashboard}
      handleToggleDelete={handleToggleDelete}
      unFollowDashboardHandler={unFollowDashboard}
      updateDashboardDetailsState={updateDashboardDetailsState}
      versionHandler={versionHandler}
      onDashboardUpdate={onDashboardUpdate}
      onUpdateVote={updateVote}
    />
  );
};

export default DashboardDetailsPage;
