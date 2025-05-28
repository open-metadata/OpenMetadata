/*
 *  Copyright 2024 Collate.
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
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../../components/Database/TableQueries/TableQueries.interface';
import MetricDetails from '../../../components/Metric/MetricDetails/MetricDetails';
import { ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { Metric } from '../../../generated/entity/data/metric';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import {
  addMetricFollower,
  getMetricByFqn,
  patchMetric,
  removeMetricFollower,
  updateMetricVote,
} from '../../../rest/metricsAPI';
import {
  addToRecentViewed,
  getEntityMissingError,
} from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { getVersionPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const MetricDetailsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const currentUserId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { fqn: metricFqn } = useFqn();
  const [metricDetails, setMetricDetails] = useState<Metric>({} as Metric);
  const [isLoading, setLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState(false);

  const [metricPermissions, setMetricPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const { id: metricId, version: currentVersion } = metricDetails;

  const saveUpdatedMetricData = (updatedData: Metric) => {
    const jsonPatch = compare(omitBy(metricDetails, isUndefined), updatedData);

    return patchMetric(metricId, jsonPatch);
  };

  const handleMetricUpdate = async (
    updatedData: Metric,
    key?: keyof Metric
  ) => {
    try {
      const res = await saveUpdatedMetricData(updatedData);

      setMetricDetails((previous) => {
        return {
          ...previous,
          version: res.version,
          ...(key ? { [key]: res[key] } : res),
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchResourcePermission = async (entityFqn: string) => {
    setLoading(true);
    try {
      const permissions = await getEntityPermissionByFqn(
        ResourceEntity.METRIC,
        entityFqn
      );
      setMetricPermissions(permissions);
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

  const fetchMetricDetail = async (metricFqn: string) => {
    setLoading(true);
    try {
      const res = await getMetricByFqn(metricFqn, {
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.FOLLOWERS,
          TabSpecificField.TAGS,
          TabSpecificField.DOMAIN,
          TabSpecificField.DATA_PRODUCTS,
          TabSpecificField.VOTES,
          TabSpecificField.EXTENSION,
          TabSpecificField.RELATED_METRICS,
        ].join(','),
      });
      const { id, fullyQualifiedName } = res;

      setMetricDetails(res);

      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.METRIC,
        fqn: fullyQualifiedName ?? '',
        timestamp: 0,
        id: id,
      });
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
            entityType: t('label.metric'),
            entityName: metricFqn,
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const followMetric = async () => {
    try {
      const res = await addMetricFollower(metricId, currentUserId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      setMetricDetails((prev) => ({
        ...prev,
        followers: [...(prev?.followers ?? []), ...newValue],
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(metricDetails),
        })
      );
    }
  };

  const unFollowMetric = async () => {
    try {
      const res = await removeMetricFollower(metricId, currentUserId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setMetricDetails((prev) => ({
        ...prev,
        followers: (prev?.followers ?? []).filter(
          (follower) => follower.id !== oldValue[0].id
        ),
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(metricDetails),
        })
      );
    }
  };

  const versionHandler = () => {
    currentVersion &&
      navigate(
        getVersionPath(EntityType.METRIC, metricFqn, toString(currentVersion))
      );
  };

  const handleToggleDelete = (version?: number) => {
    setMetricDetails((prev) => {
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

  const handleUpdateVote = async (data: QueryVote, id: string) => {
    try {
      await updateMetricVote(id, data);
      const details = await getMetricByFqn(metricFqn, {
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.FOLLOWERS,
          TabSpecificField.TAGS,
          TabSpecificField.VOTES,
        ].join(','),
      });
      setMetricDetails(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateMetricDetails = useCallback((data: DataAssetWithDomains) => {
    const updatedData = data as Metric;

    setMetricDetails((data) => ({
      ...(updatedData ?? data),
      version: updatedData.version,
    }));
  }, []);

  useEffect(() => {
    fetchResourcePermission(metricFqn);
  }, [metricFqn]);

  useEffect(() => {
    if (metricPermissions.ViewAll || metricPermissions.ViewBasic) {
      fetchMetricDetail(metricFqn);
    }
  }, [metricPermissions, metricFqn]);

  if (isLoading) {
    return <Loader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(EntityType.METRIC, metricFqn)}
      </ErrorPlaceHolder>
    );
  }
  if (!metricPermissions.ViewAll && !metricPermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.metric'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <MetricDetails
      fetchMetricDetails={() => fetchMetricDetail(metricFqn)}
      metricDetails={metricDetails}
      metricPermissions={metricPermissions}
      onFollowMetric={followMetric}
      onMetricUpdate={handleMetricUpdate}
      onToggleDelete={handleToggleDelete}
      onUnFollowMetric={unFollowMetric}
      onUpdateMetricDetails={updateMetricDetails}
      onUpdateVote={handleUpdateVote}
      onVersionChange={versionHandler}
    />
  );
};

export default MetricDetailsPage;
