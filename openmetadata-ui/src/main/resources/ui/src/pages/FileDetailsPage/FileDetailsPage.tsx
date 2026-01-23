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
import { get, isUndefined, omitBy, toString } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import FileDetails from '../../components/DriveService/File/FileDetails';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { File } from '../../generated/entity/data/file';
import { Operation as PermissionOperation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  addDriveAssetFollower,
  getDriveAssetByFqn,
  patchDriveAssetDetails,
  removeDriveAssetFollower,
  updateDriveAssetVotes,
} from '../../rest/driveAPI';
import {
  addToRecentViewed,
  getEntityMissingError,
} from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { fileDefaultFields } from '../../utils/FileDetailsUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

function FileDetailsPage() {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { fqn: fileFQN } = useFqn();
  const [fileDetails, setFileDetails] = useState<File>({} as File);
  const [isLoading, setLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState(false);

  const [filePermissions, setFilePermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const { id: fileId, version: currentVersion } = fileDetails;

  const saveUpdatedFileData = (updatedData: File) => {
    const jsonPatch = compare(omitBy(fileDetails, isUndefined), updatedData);

    return patchDriveAssetDetails<File>(fileId, jsonPatch, EntityType.FILE);
  };

  const onFileUpdate = async (updatedData: File, key?: keyof File) => {
    try {
      const res = await saveUpdatedFileData(updatedData);

      setFileDetails((previous) => {
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
        ResourceEntity.FILE,
        entityFqn
      );
      setFilePermissions(permissions);
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

  const fetchFileDetails = async (fileFQN: string) => {
    setLoading(true);
    try {
      const res = await getDriveAssetByFqn<File>(
        fileFQN,
        EntityType.FILE,
        fileDefaultFields
      );
      const { id, fullyQualifiedName, serviceType } = res;

      setFileDetails(res);

      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.FILE,
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
            entityType: t('label.file'),
            entityName: fileFQN,
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const followFile = async () => {
    try {
      const res = await addDriveAssetFollower(fileId, USERId, EntityType.FILE);
      const { newValue } = get(res, 'changeDescription.fieldsAdded[0]', {});
      setFileDetails((prev) => ({
        ...prev,
        followers: [...(prev?.followers ?? []), ...newValue],
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(fileDetails),
        })
      );
    }
  };

  const unFollowFile = async () => {
    try {
      const res = await removeDriveAssetFollower(
        fileId,
        USERId,
        EntityType.FILE
      );
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setFileDetails((prev) => ({
        ...prev,
        followers: (prev?.followers ?? []).filter(
          (follower) => follower.id !== oldValue[0].id
        ),
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(fileDetails),
        })
      );
    }
  };

  const versionHandler = () => {
    currentVersion &&
      navigate(
        getVersionPath(EntityType.FILE, fileFQN, toString(currentVersion))
      );
  };

  const handleToggleDelete = (version?: number) => {
    setFileDetails((prev) => {
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
      await updateDriveAssetVotes<File>(id, data, EntityType.FILE);
      const details = await getDriveAssetByFqn<File>(
        fileFQN,
        EntityType.FILE,
        [
          TabSpecificField.OWNERS,
          TabSpecificField.FOLLOWERS,
          TabSpecificField.TAGS,
          TabSpecificField.VOTES,
        ].join(',')
      );
      setFileDetails(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateFileDetailsState = useCallback((data: DataAssetWithDomains) => {
    const updatedData = data as File;

    setFileDetails((prevData) => ({
      ...prevData,
      ...updatedData,
    }));
  }, []);

  useEffect(() => {
    fetchResourcePermission(fileFQN);
  }, [fileFQN]);

  useEffect(() => {
    if (
      getPrioritizedViewPermission(
        filePermissions,
        PermissionOperation.ViewBasic
      )
    ) {
      fetchFileDetails(fileFQN);
    }
  }, [filePermissions, fileFQN]);

  if (isLoading) {
    return <Loader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('file', fileFQN)}
      </ErrorPlaceHolder>
    );
  }
  if (!filePermissions.ViewAll && !filePermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.file'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <FileDetails
      fetchFile={() => fetchFileDetails(fileFQN)}
      fileDetails={fileDetails}
      filePermissions={filePermissions}
      followFileHandler={followFile}
      handleToggleDelete={handleToggleDelete}
      unFollowFileHandler={unFollowFile}
      updateFileDetailsState={updateFileDetailsState}
      versionHandler={versionHandler}
      onFileUpdate={onFileUpdate}
      onUpdateVote={updateVote}
    />
  );
}

export default withActivityFeed(FileDetailsPage);
