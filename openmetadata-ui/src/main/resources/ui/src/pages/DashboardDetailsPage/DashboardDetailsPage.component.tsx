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
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import DashboardDetails from '../../components/Dashboard/DashboardDetails/DashboardDetails.component';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  addFollower,
  getDashboardByFqn,
  patchDashboardDetails,
  removeFollower,
  updateDashboardVotes,
} from '../../rest/dashboardAPI';
import {
  addToRecentViewed,
  getEntityMissingError,
} from '../../utils/CommonUtils';
import { defaultFields } from '../../utils/DashboardDetailsUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export type ChartType = {
  displayName: string;
} & Chart;

const DashboardDetailsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { fqn: dashboardFQN } = useFqn();
  const [dashboardDetails, setDashboardDetails] = useState<Dashboard>(
    {} as Dashboard
  );
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState(false);

  const [dashboardPermissions, setDashboardPermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { id: dashboardId, version, charts } = dashboardDetails;

  const fetchResourcePermission = async (entityFqn: string) => {
    setLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.DASHBOARD,
        entityFqn
      );
      setDashboardPermissions(entityPermission);
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
      const res = await getDashboardByFqn(dashboardFQN, { fields });

      const { id, fullyQualifiedName, serviceType } = res;
      setDashboardDetails(res);

      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.DASHBOARD,
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
    key?: keyof Dashboard
  ) => {
    try {
      const response = await saveUpdatedDashboardData(updatedDashboard);
      setDashboardDetails((previous) => {
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

  const versionHandler = () => {
    version &&
      navigate(
        getVersionPath(EntityType.DASHBOARD, dashboardFQN, toString(version))
      );
  };

  const handleToggleDelete = (version?: number) => {
    setDashboardDetails((prev) => {
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
      await updateDashboardVotes(id, data);
      const details = await getDashboardByFqn(dashboardFQN, {
        fields: defaultFields,
      });
      setDashboardDetails(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateDashboardDetailsState = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as Dashboard;

      setDashboardDetails((data) => ({
        ...(updatedData ?? data),
        version: updatedData.version,
      }));
    },
    []
  );

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
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.dashboard-detail-plural-lowercase'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <DashboardDetails
      charts={charts ?? []}
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
