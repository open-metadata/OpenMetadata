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
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import APIEndpointDetails from '../../components/APIEndpoint/APIEndpointDetails/APIEndpointDetails';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { APIEndpoint } from '../../generated/entity/data/apiEndpoint';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  addApiEndpointFollower,
  getApiEndPointByFQN,
  patchApiEndPoint,
  removeApiEndpointFollower,
  updateApiEndPointVote,
} from '../../rest/apiEndpointsAPI';
import {
  addToRecentViewed,
  getEntityMissingError,
} from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const APIEndpointPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const currentUserId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { fqn: apiEndpointFqn } = useFqn();
  const [apiEndpointDetails, setApiEndpointDetails] = useState<APIEndpoint>(
    {} as APIEndpoint
  );
  const [isLoading, setLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState(false);

  const [apiEndpointPermissions, setApiEndpointPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const { id: apiEndpointId, version: currentVersion } = apiEndpointDetails;

  const saveUpdatedApiEndpointData = (updatedData: APIEndpoint) => {
    const jsonPatch = compare(
      omitBy(apiEndpointDetails, isUndefined),
      updatedData
    );

    return patchApiEndPoint(apiEndpointId, jsonPatch);
  };

  const handleApiEndpointUpdate = async (
    updatedData: APIEndpoint,
    key?: keyof APIEndpoint
  ) => {
    try {
      const res = await saveUpdatedApiEndpointData(updatedData);

      setApiEndpointDetails((previous) => {
        return {
          ...previous,
          ...res,
          ...(key && { [key]: res[key] }),
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
        ResourceEntity.API_ENDPOINT,
        entityFqn
      );
      setApiEndpointPermissions(permissions);
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

  const fetchApiEndPointDetail = async (apiEndpointFqn: string) => {
    setLoading(true);
    try {
      const res = await getApiEndPointByFQN(apiEndpointFqn, {
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.FOLLOWERS,
          TabSpecificField.TAGS,
          TabSpecificField.DOMAIN,
          TabSpecificField.DATA_PRODUCTS,
          TabSpecificField.VOTES,
          TabSpecificField.EXTENSION,
        ].join(','),
      });
      const { id, fullyQualifiedName, serviceType } = res;

      setApiEndpointDetails(res);

      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.API_ENDPOINT,
        fqn: fullyQualifiedName ?? '',
        serviceType: serviceType,
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
            entityType: t('label.api-endpoint'),
            entityName: apiEndpointFqn,
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const followApiEndPoint = async () => {
    try {
      const res = await addApiEndpointFollower(apiEndpointId, currentUserId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      setApiEndpointDetails((prev) => ({
        ...prev,
        followers: [...(prev?.followers ?? []), ...newValue],
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(apiEndpointDetails),
        })
      );
    }
  };

  const unFollowApiEndPoint = async () => {
    try {
      const res = await removeApiEndpointFollower(apiEndpointId, currentUserId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setApiEndpointDetails((prev) => ({
        ...prev,
        followers: (prev?.followers ?? []).filter(
          (follower) => follower.id !== oldValue[0].id
        ),
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(apiEndpointDetails),
        })
      );
    }
  };

  const versionHandler = () => {
    currentVersion &&
      navigate(
        getVersionPath(
          EntityType.API_ENDPOINT,
          apiEndpointFqn,
          toString(currentVersion)
        )
      );
  };

  const handleToggleDelete = (version?: number) => {
    setApiEndpointDetails((prev) => {
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
      await updateApiEndPointVote(id, data);
      const details = await getApiEndPointByFQN(apiEndpointFqn, {
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.FOLLOWERS,
          TabSpecificField.TAGS,
          TabSpecificField.VOTES,
        ].join(','),
      });
      setApiEndpointDetails(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateApiEndpointDetails = useCallback((data: DataAssetWithDomains) => {
    const updatedData = data as APIEndpoint;

    setApiEndpointDetails((data) => ({
      ...(updatedData ?? data),
      version: updatedData.version,
    }));
  }, []);

  useEffect(() => {
    fetchResourcePermission(apiEndpointFqn);
  }, [apiEndpointFqn]);

  useEffect(() => {
    if (apiEndpointPermissions.ViewAll || apiEndpointPermissions.ViewBasic) {
      fetchApiEndPointDetail(apiEndpointFqn);
    }
  }, [apiEndpointPermissions, apiEndpointFqn]);

  if (isLoading) {
    return <Loader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('apiEndpoint', apiEndpointFqn)}
      </ErrorPlaceHolder>
    );
  }
  if (!apiEndpointPermissions.ViewAll && !apiEndpointPermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.api-endpoint'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <APIEndpointDetails
      apiEndpointDetails={apiEndpointDetails}
      apiEndpointPermissions={apiEndpointPermissions}
      fetchAPIEndpointDetails={() => fetchApiEndPointDetail(apiEndpointFqn)}
      onApiEndpointUpdate={handleApiEndpointUpdate}
      onFollowApiEndPoint={followApiEndPoint}
      onToggleDelete={handleToggleDelete}
      onUnFollowApiEndPoint={unFollowApiEndPoint}
      onUpdateApiEndpointDetails={updateApiEndpointDetails}
      onUpdateVote={handleUpdateVote}
      onVersionChange={versionHandler}
    />
  );
};

export default APIEndpointPage;
