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
import { PageLoader } from '../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import FileDetails from '../../components/DriveService/File/FileDetails';
import { ROUTES } from '../../constants/constants';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { File } from '../../generated/entity/data/file';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../hooks/useFqn';
import {
  addDriveAssetFollower,
  getDriveAssetByFqn,
  patchDriveAssetDetails,
  removeDriveAssetFollower,
  updateDriveAssetVotes,
} from '../../rest/driveAPI';
import { getEntityMissingError } from '../../utils/EntityDisplayPureUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { fileDefaultFields } from '../../utils/FileDetailsUtils';
import { addToRecentViewed } from '../../utils/RecentActivityUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

function FileDetailsPage() {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const navigate = useNavigate();

  const { fqn: fileFQN } = useFqn();
  const [fileDetails, setFileDetails] = useState<File>({} as File);
  // Entity-fetch loading only now — permission-fetch loading comes from the hook below.
  // Combined at the render gate as `isPermissionsLoading || (canViewBasic &&
  // isEntityLoading)` — see SpreadsheetDetailsPage.tsx's analogous comment for why the
  // `canViewBasic` guard matters (a denied-view render must not get stuck on the loader
  // forever, since fetchFileDetails — the only thing that ever flips this flag false — is
  // never called at all when view permission is denied).
  const [isEntityLoading, setEntityLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState(false);

  // Single useEntityPermissions call — no genuine cycle: this page never derives a
  // `deleted`-gated canEdit* flag of its own. FileDetails (the child) owns the raw
  // filePermissions prop and derives its own edit-tier flags against its own `deleted`
  // (sourced from fileDetails.deleted) — see TopicDetailsPage.component.tsx's analogous
  // comment.
  const {
    permissions: filePermissions, // FileDetails consumes the raw OperationPermission prop
    isLoading: isPermissionsLoading,
    error: permissionsError,
    canViewBasic,
    hasViewAccess,
  } = useEntityPermissions(ResourceEntity.FILE, fileFQN);

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

  const fetchFileDetails = async (fileFQN: string) => {
    setEntityLoading(true);
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
      setEntityLoading(false);
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

  // Permission fetching itself now lives in useEntityPermissions (called above). Preserves
  // the old fetchResourcePermission catch's exact toast (interpolating the FQN itself, not
  // a translated entity-type label) — matches TopicDetailsPage.component.tsx's analogous
  // effect.
  useEffect(() => {
    if (permissionsError) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', { entity: fileFQN })
      );
    }
  }, [permissionsError, fileFQN]);

  useEffect(() => {
    if (canViewBasic) {
      fetchFileDetails(fileFQN);
    }
  }, [canViewBasic, fileFQN]);

  if (isPermissionsLoading || (canViewBasic && isEntityLoading)) {
    return <PageLoader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('file', fileFQN)}
      </ErrorPlaceHolder>
    );
  }
  if (!hasViewAccess) {
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
