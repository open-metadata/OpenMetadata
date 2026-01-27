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
import SpreadsheetDetails from '../../components/DriveService/Spreadsheet/SpreadsheetDetails';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Spreadsheet } from '../../generated/entity/data/spreadsheet';
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
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { defaultFields } from '../../utils/SpreadsheetDetailsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const SpreadsheetDetailsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { fqn: spreadsheetFQN } = useFqn();
  const [spreadsheetDetails, setSpreadsheetDetails] = useState<Spreadsheet>(
    {} as Spreadsheet
  );
  const [isLoading, setLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState(false);

  const [spreadsheetPermissions, setSpreadsheetPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const { id: spreadsheetId, version: currentVersion } = spreadsheetDetails;

  const saveUpdatedSpreadsheetData = (updatedData: Spreadsheet) => {
    const jsonPatch = compare(
      omitBy(spreadsheetDetails, isUndefined),
      updatedData
    );

    return patchDriveAssetDetails<Spreadsheet>(
      spreadsheetId,
      jsonPatch,
      EntityType.SPREADSHEET
    );
  };

  const onSpreadsheetUpdate = async (
    updatedData: Spreadsheet,
    key?: keyof Spreadsheet
  ) => {
    try {
      const res = await saveUpdatedSpreadsheetData(updatedData);

      setSpreadsheetDetails((previous) => {
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
        ResourceEntity.SPREADSHEET,
        entityFqn
      );
      setSpreadsheetPermissions(permissions);
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

  const fetchSpreadsheetDetails = async (spreadsheetFQN: string) => {
    setLoading(true);
    try {
      const res = await getDriveAssetByFqn<Spreadsheet>(
        spreadsheetFQN,
        EntityType.SPREADSHEET,
        defaultFields
      );
      const { id, fullyQualifiedName, serviceType } = res;

      setSpreadsheetDetails(res);

      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.SPREADSHEET,
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
            entityType: t('label.spreadsheet'),
            entityName: spreadsheetFQN,
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const followSpreadsheet = async () => {
    try {
      const res = await addDriveAssetFollower(
        spreadsheetId,
        USERId,
        EntityType.SPREADSHEET
      );
      const { newValue } = get(res, 'changeDescription.fieldsAdded[0]', {});
      setSpreadsheetDetails((prev) => ({
        ...prev,
        followers: [...(prev?.followers ?? []), ...newValue],
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(spreadsheetDetails),
        })
      );
    }
  };

  const unFollowSpreadsheet = async () => {
    try {
      const res = await removeDriveAssetFollower(
        spreadsheetId,
        USERId,
        EntityType.SPREADSHEET
      );
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setSpreadsheetDetails((prev) => ({
        ...prev,
        followers: (prev?.followers ?? []).filter(
          (follower) => follower.id !== oldValue[0].id
        ),
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(spreadsheetDetails),
        })
      );
    }
  };

  const versionHandler = () => {
    currentVersion &&
      navigate(
        getVersionPath(
          EntityType.SPREADSHEET,
          spreadsheetFQN,
          toString(currentVersion)
        )
      );
  };

  const handleToggleDelete = (version?: number) => {
    setSpreadsheetDetails((prev) => {
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
      await updateDriveAssetVotes<Spreadsheet>(
        id,
        data,
        EntityType.SPREADSHEET
      );
      const details = await getDriveAssetByFqn<Spreadsheet>(
        spreadsheetFQN,
        EntityType.SPREADSHEET,
        [
          TabSpecificField.OWNERS,
          TabSpecificField.FOLLOWERS,
          TabSpecificField.TAGS,
          TabSpecificField.VOTES,
        ].join(',')
      );
      setSpreadsheetDetails(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateSpreadsheetDetailsState = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as Spreadsheet;

      setSpreadsheetDetails((prevData) => ({
        ...prevData,
        ...updatedData,
      }));
    },
    []
  );

  useEffect(() => {
    fetchResourcePermission(spreadsheetFQN);
  }, [spreadsheetFQN]);

  useEffect(() => {
    if (
      getPrioritizedViewPermission(
        spreadsheetPermissions,
        PermissionOperation.ViewBasic
      )
    ) {
      fetchSpreadsheetDetails(spreadsheetFQN);
    }
  }, [spreadsheetPermissions, spreadsheetFQN]);

  if (isLoading) {
    return <Loader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('spreadsheet', spreadsheetFQN)}
      </ErrorPlaceHolder>
    );
  }
  if (!spreadsheetPermissions.ViewAll && !spreadsheetPermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.spreadsheet'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <SpreadsheetDetails
      fetchSpreadsheet={() => fetchSpreadsheetDetails(spreadsheetFQN)}
      followSpreadsheetHandler={followSpreadsheet}
      handleToggleDelete={handleToggleDelete}
      spreadsheetDetails={spreadsheetDetails}
      spreadsheetPermissions={spreadsheetPermissions}
      unFollowSpreadsheetHandler={unFollowSpreadsheet}
      updateSpreadsheetDetailsState={updateSpreadsheetDetailsState}
      versionHandler={versionHandler}
      onSpreadsheetUpdate={onSpreadsheetUpdate}
      onUpdateVote={updateVote}
    />
  );
};

export default withActivityFeed(SpreadsheetDetailsPage);
