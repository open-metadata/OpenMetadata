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
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ChartDetails from '../../components/Chart/ChartDetails/ChartDetails.component';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Chart } from '../../generated/entity/data/chart';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  addFollower,
  getChartByFqn,
  patchChartDetails,
  removeFollower,
  updateChartVotes,
} from '../../rest/chartsAPI';
import { defaultFields } from '../../utils/ChartDetailsUtils';
import {
  addToRecentViewed,
  getEntityMissingError,
} from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const ChartDetailsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { fqn: chartFQN } = useFqn();
  const [chartDetails, setChartDetails] = useState<Chart>({} as Chart);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState(false);

  const [chartPermissions, setChartPermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { id: chartId, version } = chartDetails;

  const fetchResourcePermission = async (entityFqn: string) => {
    setLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.CHART,
        entityFqn
      );
      setChartPermissions(entityPermission);
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: entityFqn,
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const saveUpdatedChartData = (updatedData: Chart) => {
    const jsonPatch = compare(omitBy(chartDetails, isUndefined), updatedData);

    return patchChartDetails(chartId, jsonPatch);
  };

  const viewUsagePermission = useMemo(
    () => chartPermissions.ViewAll || chartPermissions.ViewUsage,
    [chartPermissions]
  );

  const fetchChartDetail = async (chartFQN: string) => {
    setLoading(true);

    try {
      let fields = defaultFields;
      if (viewUsagePermission) {
        fields += `,${TabSpecificField.USAGE_SUMMARY}`;
      }
      const res = await getChartByFqn(chartFQN, { fields });

      const { id, fullyQualifiedName, serviceType } = res;
      setChartDetails(res);

      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.CHART,
        fqn: fullyQualifiedName ?? '',
        serviceType: serviceType,
        timestamp: 0,
        id: id,
      });

      setLoading(false);
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        setIsError(true);
      } else if (
        (error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN
      ) {
        navigate(ROUTES.FORBIDDEN, { replace: true });
      } else {
        showErrorToast(
          error as AxiosError,
          t('server.entity-details-fetch-error', {
            entityType: t('label.chart'),
            entityName: chartFQN,
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const onChartUpdate = async (updatedChart: Chart, key?: keyof Chart) => {
    try {
      const response = await saveUpdatedChartData(updatedChart);
      setChartDetails((previous) => {
        return {
          ...previous,
          version: response.version,
          ...(key ? { [key]: response[key] } : response),
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const followChart = async () => {
    try {
      const res = await addFollower(chartId, USERId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      setChartDetails((prev) => ({
        ...prev,
        followers: [...(prev?.followers ?? []), ...newValue],
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(chartDetails),
        })
      );
    }
  };

  const unFollowChart = async () => {
    try {
      const res = await removeFollower(chartId, USERId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];

      setChartDetails((prev) => ({
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
          entity: getEntityName(chartDetails),
        })
      );
    }
  };

  const versionHandler = () => {
    version &&
      navigate(getVersionPath(EntityType.CHART, chartFQN, toString(version)));
  };

  const handleToggleDelete = (version?: number) => {
    setChartDetails((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        deleted: !prev?.deleted,
        ...(version ? { version } : {}),
      };
    });
  };

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateChartVotes(id, data);
      const details = await getChartByFqn(chartFQN, {
        fields: defaultFields,
      });
      setChartDetails(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateChartDetailsState = useCallback((data: DataAssetWithDomains) => {
    const updatedData = data as Chart;

    setChartDetails((data) => ({
      ...(updatedData ?? data),
      version: updatedData.version,
    }));
  }, []);

  useEffect(() => {
    if (chartPermissions.ViewAll || chartPermissions.ViewBasic) {
      fetchChartDetail(chartFQN);
    }
  }, [chartFQN, chartPermissions]);

  useEffect(() => {
    fetchResourcePermission(chartFQN);
  }, [chartFQN]);

  if (isLoading) {
    return <Loader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('chart', chartFQN)}
      </ErrorPlaceHolder>
    );
  }
  if (!chartPermissions.ViewAll && !chartPermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.chart-plural'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <ChartDetails
      chartDetails={chartDetails}
      fetchChart={() => fetchChartDetail(chartFQN)}
      followChartHandler={followChart}
      handleToggleDelete={handleToggleDelete}
      unFollowChartHandler={unFollowChart}
      updateChartDetailsState={updateChartDetailsState}
      versionHandler={versionHandler}
      onChartUpdate={onChartUpdate}
      onUpdateVote={updateVote}
    />
  );
};

export default ChartDetailsPage;
