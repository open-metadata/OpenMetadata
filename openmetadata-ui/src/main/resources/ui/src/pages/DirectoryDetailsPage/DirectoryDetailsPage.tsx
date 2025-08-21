/*
 *  Copyright 2025 Collate.
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
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import DirectoryDetails from '../../components/Directory/DirectoryDetails';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Directory } from '../../generated/entity/data/directory';
import { Operation as PermissionOperation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  addFollower,
  getDirectoryByFqn,
  patchDirectoryDetails,
  removeFollower,
  updateDirectoryVotes,
} from '../../rest/driveAPI';
import {
  addToRecentViewed,
  getEntityMissingError,
} from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const DirectoryDetailsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { fqn: directoryFQN } = useFqn();
  const [directoryDetails, setDirectoryDetails] = useState<Directory>(
    {} as Directory
  );
  const [isLoading, setLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState(false);

  const [directoryPermissions, setDirectoryPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const { id: directoryId, version: currentVersion } = directoryDetails;

  const saveUpdatedDirectoryData = (updatedData: Directory) => {
    const jsonPatch = compare(
      omitBy(directoryDetails, isUndefined),
      updatedData
    );

    return patchDirectoryDetails(directoryId, jsonPatch);
  };

  const onDirectoryUpdate = async (
    updatedData: Directory,
    key?: keyof Directory
  ) => {
    try {
      const res = await saveUpdatedDirectoryData(updatedData);

      setDirectoryDetails((previous) => {
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
        ResourceEntity.DIRECTORY,
        entityFqn
      );
      setDirectoryPermissions(permissions);
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

  const fetchDirectoryDetails = async (directoryFQN: string) => {
    setLoading(true);
    try {
      const res = await getDirectoryByFqn(
        directoryFQN,
        [
          TabSpecificField.OWNERS,
          TabSpecificField.CHILDREN,
          TabSpecificField.FOLLOWERS,
          TabSpecificField.TAGS,
          TabSpecificField.DOMAINS,
          TabSpecificField.DATA_PRODUCTS,
          TabSpecificField.VOTES,
          TabSpecificField.EXTENSION,
        ].join(',')
      );
      const { id, fullyQualifiedName, serviceType } = res;

      setDirectoryDetails(res);

      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.DIRECTORY,
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
            entityType: t('label.pipeline'),
            entityName: directoryFQN,
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const followDirectory = async () => {
    try {
      const res = await addFollower(directoryId, USERId);
      const { newValue } = res.changeDescription?.fieldsAdded?.[0];
      setDirectoryDetails((prev) => ({
        ...prev,
        followers: [...(prev?.followers ?? []), ...newValue],
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(directoryDetails),
        })
      );
    }
  };

  const unFollowDirectory = async () => {
    try {
      const res = await removeFollower(directoryId, USERId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setDirectoryDetails((prev) => ({
        ...prev,
        followers: (prev?.followers ?? []).filter(
          (follower) => follower.id !== oldValue[0].id
        ),
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(directoryDetails),
        })
      );
    }
  };

  const versionHandler = () => {
    currentVersion &&
      navigate(
        getVersionPath(
          EntityType.DIRECTORY,
          directoryFQN,
          toString(currentVersion)
        )
      );
  };

  const handleToggleDelete = (version?: number) => {
    setDirectoryDetails((prev) => {
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
      await updateDirectoryVotes(id, data);
      const details = await getDirectoryByFqn(
        directoryFQN,
        [
          TabSpecificField.OWNERS,
          TabSpecificField.FOLLOWERS,
          TabSpecificField.TAGS,
          TabSpecificField.VOTES,
        ].join(',')
      );
      setDirectoryDetails(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateDirectoryDetailsState = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as Directory;

      setDirectoryDetails((data) => ({
        ...(updatedData ?? data),
        version: updatedData.version,
      }));
    },
    []
  );

  useEffect(() => {
    fetchResourcePermission(directoryFQN);
  }, [directoryFQN]);

  useEffect(() => {
    if (
      getPrioritizedViewPermission(
        directoryPermissions,
        PermissionOperation.ViewBasic
      )
    ) {
      fetchDirectoryDetails(directoryFQN);
    }
  }, [directoryPermissions, directoryFQN]);

  if (isLoading) {
    return <Loader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('directory', directoryFQN)}
      </ErrorPlaceHolder>
    );
  }
  if (!directoryPermissions.ViewAll && !directoryPermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.directory'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <DirectoryDetails
      directoryDetails={directoryDetails}
      directoryPermissions={directoryPermissions}
      fetchDirectory={() => fetchDirectoryDetails(directoryFQN)}
      followDirectoryHandler={followDirectory}
      handleToggleDelete={handleToggleDelete}
      unFollowDirectoryHandler={unFollowDirectory}
      updateDirectoryDetailsState={updateDirectoryDetailsState}
      versionHandler={versionHandler}
      onDirectoryUpdate={onDirectoryUpdate}
      onUpdateVote={updateVote}
    />
  );
};

export default withActivityFeed(DirectoryDetailsPage);
