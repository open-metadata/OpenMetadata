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
import WorksheetDetails from '../../components/DriveService/Worksheet/WorksheetDetails';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Worksheet } from '../../generated/entity/data/worksheet';
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
import Fqn from '../../utils/Fqn';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { defaultFields } from '../../utils/WorksheetDetailsUtils';

const WorksheetDetailsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { fqn: decodedWorksheetFQN } = useFqn();
  const [worksheetDetails, setWorksheetDetails] = useState<Worksheet>(
    {} as Worksheet
  );
  const [isLoading, setLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState(false);
  const [resolvedEntityFqn, setResolvedEntityFqn] = useState<string>('');
  const [activeColumnFqn, setActiveColumnFqn] = useState<string | undefined>(
    undefined
  );

  const [worksheetPermissions, setWorksheetPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const { id: worksheetId, version: currentVersion } = worksheetDetails;

  const saveUpdatedWorksheetData = (updatedData: Worksheet) => {
    const jsonPatch = compare(
      omitBy(worksheetDetails, isUndefined),
      updatedData
    );

    return patchDriveAssetDetails<Worksheet>(
      worksheetId,
      jsonPatch,
      EntityType.WORKSHEET
    );
  };

  const onWorksheetUpdate = async (updatedData: Worksheet) => {
    try {
      await saveUpdatedWorksheetData(updatedData);

      const res = await getDriveAssetByFqn<Worksheet>(
        worksheetDetails.fullyQualifiedName ?? decodedWorksheetFQN,
        EntityType.WORKSHEET,
        defaultFields
      );

      setWorksheetDetails(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchWorksheetDetails = async (worksheetFQN: string) => {
    setLoading(true);
    try {
      const res = await getDriveAssetByFqn<Worksheet>(
        worksheetFQN,
        EntityType.WORKSHEET,
        defaultFields
      );
      const { id, fullyQualifiedName, serviceType } = res;

      setWorksheetDetails(res);

      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.WORKSHEET,
        fqn: fullyQualifiedName ?? '',
        serviceType: serviceType,
        timestamp: 0,
        id: id,
      });
    } catch (error) {
      // Re-throw 404 to be handled by the caller (permission fetcher fallback)
      if ((error as AxiosError).response?.status === 404) {
        throw error;
      }
      if ((error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN) {
        navigate(ROUTES.FORBIDDEN, { replace: true });
      } else {
        showErrorToast(
          error as AxiosError,
          t('server.entity-details-fetch-error', {
            entityType: t('label.worksheet'),
            entityName: worksheetFQN,
          })
        );
      }
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchResourcePermission = async (
    entityFqn: string,
    isFallback = false
  ) => {
    setLoading(true);
    try {
      const permissions = await getEntityPermissionByFqn(
        ResourceEntity.WORKSHEET,
        entityFqn
      );

      setWorksheetPermissions(permissions);

      const viewBasicPermission = getPrioritizedViewPermission(
        permissions,
        PermissionOperation.ViewBasic
      );

      if (viewBasicPermission) {
        await fetchWorksheetDetails(entityFqn);
      } else {
        setLoading(false);
      }

      setResolvedEntityFqn(entityFqn);

      // If we successfully resolved using fallback, the remainder is the column
      if (isFallback) {
        setActiveColumnFqn(decodedWorksheetFQN);
      } else {
        setActiveColumnFqn(undefined);
      }
    } catch (error) {
      if ((error as AxiosError)?.response?.status === ClientErrors.NOT_FOUND) {
        const parentParts = Fqn.split(entityFqn).slice(0, -1);
        if (parentParts.length > 0) {
          const parentFqn = Fqn.build(...parentParts);
          await fetchResourcePermission(parentFqn, true);

          return;
        }
      }

      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: entityFqn,
        })
      );
      setIsError(true);
      setLoading(false);
    }
  };

  const followWorksheet = async () => {
    try {
      const res = await addDriveAssetFollower(
        worksheetId,
        USERId,
        EntityType.WORKSHEET
      );
      const { newValue } = get(res, 'changeDescription.fieldsAdded[0]', {});
      setWorksheetDetails((prev) => ({
        ...prev,
        followers: [...(prev?.followers ?? []), ...newValue],
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(worksheetDetails),
        })
      );
    }
  };

  const unFollowWorksheet = async () => {
    try {
      const res = await removeDriveAssetFollower(
        worksheetId,
        USERId,
        EntityType.WORKSHEET
      );
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setWorksheetDetails((prev) => ({
        ...prev,
        followers: (prev?.followers ?? []).filter(
          (follower) => follower.id !== oldValue[0].id
        ),
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(worksheetDetails),
        })
      );
    }
  };

  const versionHandler = () => {
    currentVersion &&
      navigate(
        getVersionPath(
          EntityType.WORKSHEET,
          decodedWorksheetFQN,
          toString(currentVersion)
        )
      );
  };

  const handleToggleDelete = (version?: number) => {
    setWorksheetDetails((prev) => {
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
      await updateDriveAssetVotes<Worksheet>(id, data, EntityType.WORKSHEET);
      const details = await getDriveAssetByFqn<Worksheet>(
        decodedWorksheetFQN,
        EntityType.WORKSHEET,
        [
          TabSpecificField.OWNERS,
          TabSpecificField.FOLLOWERS,
          TabSpecificField.TAGS,
          TabSpecificField.VOTES,
        ].join(',')
      );
      setWorksheetDetails(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateWorksheetDetailsState = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as Worksheet;

      setWorksheetDetails((prevData) => ({
        ...prevData,
        ...updatedData,
      }));
    },
    []
  );

  useEffect(() => {
    if (
      resolvedEntityFqn &&
      (decodedWorksheetFQN === resolvedEntityFqn ||
        decodedWorksheetFQN.startsWith(resolvedEntityFqn + FQN_SEPARATOR_CHAR))
    ) {
      setActiveColumnFqn(
        decodedWorksheetFQN === resolvedEntityFqn
          ? undefined
          : decodedWorksheetFQN
      );

      return;
    }

    fetchResourcePermission(decodedWorksheetFQN);
  }, [decodedWorksheetFQN, resolvedEntityFqn]);

  if (isLoading) {
    return <Loader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('worksheet', decodedWorksheetFQN)}
      </ErrorPlaceHolder>
    );
  }
  if (!worksheetPermissions.ViewAll && !worksheetPermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.worksheet'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <WorksheetDetails
      activeColumnFqn={activeColumnFqn}
      fetchWorksheet={() => fetchWorksheetDetails(resolvedEntityFqn)}
      followWorksheetHandler={followWorksheet}
      handleToggleDelete={handleToggleDelete}
      unFollowWorksheetHandler={unFollowWorksheet}
      updateWorksheetDetailsState={updateWorksheetDetailsState}
      versionHandler={versionHandler}
      worksheetDetails={worksheetDetails}
      worksheetPermissions={worksheetPermissions}
      onUpdateVote={updateVote}
      onWorksheetUpdate={onWorksheetUpdate}
    />
  );
};

export default withActivityFeed(WorksheetDetailsPage);
