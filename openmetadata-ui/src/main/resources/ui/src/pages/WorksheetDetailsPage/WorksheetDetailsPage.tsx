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
import WorksheetDetails from '../../components/DriveService/Worksheet/WorksheetDetails';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { ROUTES } from '../../constants/constants';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Worksheet } from '../../generated/entity/data/worksheet';
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
import Fqn from '../../utils/Fqn';
import { addToRecentViewed } from '../../utils/RecentActivityUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { defaultFields } from '../../utils/WorksheetDetailsUtils';

const WorksheetDetailsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const navigate = useNavigate();

  const { fqn: decodedWorksheetFQN } = useFqn();
  const [worksheetDetails, setWorksheetDetails] = useState<Worksheet>(
    {} as Worksheet
  );
  const [isError, setIsError] = useState(false);
  // {@code resolvedEntityFqn} is the FQN we've committed to fetching permissions and entity
  // data against. When a deep link points at a column (service.worksheet.column), the
  // initial lookup 404s and we walk up to the parent worksheet; this stores the parent we
  // ultimately landed on — mirrors ContainerPage.tsx's identically-named, identically-used
  // state.
  const [resolvedEntityFqn, setResolvedEntityFqn] = useState<string>('');
  const [activeColumnFqn, setActiveColumnFqn] = useState<string | undefined>(
    undefined
  );
  // Entity-fetch loading only — permission-fetch loading comes from the hook below. Combined
  // at the render gate as `!resolvedEntityFqn || isPermissionsLoading || (canViewBasic &&
  // isEntityLoading)`; see SpreadsheetDetailsPage.tsx's analogous comment for why the
  // `canViewBasic` guard matters. The extra `!resolvedEntityFqn` clause covers the one frame
  // before the seeding effect below has run (this page has no independent loading source
  // like useCustomPages to cover that gap, unlike ContainerPage.tsx).
  const [isEntityLoading, setEntityLoading] = useState<boolean>(true);

  // Single useEntityPermissions call, keyed on resolvedEntityFqn (not the raw URL
  // decodedWorksheetFQN) — mirrors ContainerPage.tsx's identifier choice: a column deep-link
  // resolves to its parent worksheet's FQN via the fallback effects below, and permissions
  // must be re-derived for that resolved FQN, not the original URL segment. No `deleted`
  // option: this page never derives a `deleted`-gated canEdit* flag of its own —
  // WorksheetDetails (the child) owns the raw worksheetPermissions prop and derives its own
  // edit-tier flags against its own `deleted` (sourced from worksheetDetails.deleted).
  const {
    permissions: worksheetPermissions, // WorksheetDetails consumes the raw OperationPermission prop
    isLoading: isPermissionsLoading,
    error: permissionsError,
    canViewBasic,
    hasViewAccess,
  } = useEntityPermissions(ResourceEntity.WORKSHEET, resolvedEntityFqn);

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
    setEntityLoading(true);
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
      const status = (error as AxiosError)?.response?.status;
      // Column-deep-link fallback: `worksheetFQN` (== resolvedEntityFqn at call time) did
      // not resolve to an actual worksheet — likely a column FQN, since the drive-asset
      // endpoint doesn't resolve columns. Walk up to the parent worksheet and re-resolve;
      // setting resolvedEntityFqn also re-triggers permission fetching for the new
      // identifier via useEntityPermissions (a different query key). Mirrors
      // ContainerPage.tsx's analogous containerError-driven fallback. Old code reached this
      // same walk-up by re-throwing to fetchResourcePermission's catch (now removed —
      // permission fetching is decoupled, so the walk-up lives here instead).
      //
      // Single-hop guard (`!activeColumnFqn && worksheetFQN === decodedWorksheetFQN`),
      // mirroring ContainerPage.tsx's approved fallback shape and Path B (the
      // permissionsError effect) below: only attempt the walk-up while still resolving the
      // original deep-link FQN, not a second hop from an already-walked parent.
      const canWalkUp =
        status === ClientErrors.NOT_FOUND &&
        !activeColumnFqn &&
        worksheetFQN === decodedWorksheetFQN;
      const parentParts = canWalkUp ? Fqn.split(worksheetFQN).slice(0, -1) : [];

      if (parentParts.length > 0) {
        setActiveColumnFqn(worksheetFQN);
        setResolvedEntityFqn(Fqn.build(...parentParts));
      } else if (status === ClientErrors.NOT_FOUND) {
        // Terminal 404: no parent to fall back to (or already past the single allowed
        // hop). Old code's terminal branch (shared between permission-fetch and
        // entity-fetch 404s, via the re-throw) showed this exact permission-fetch-error
        // toast regardless of which fetch actually failed; preserved verbatim rather than
        // switching to the entity-fetch toast text.
        showErrorToast(
          t('server.fetch-entity-permissions-error', { entity: worksheetFQN })
        );
        setIsError(true);
      } else if (status === ClientErrors.FORBIDDEN) {
        navigate(ROUTES.FORBIDDEN, { replace: true });
      } else {
        showErrorToast(
          error as AxiosError,
          t('server.entity-details-fetch-error', {
            entityType: t('label.worksheet'),
            entityName: worksheetFQN,
          })
        );
        setIsError(true);
      }
    } finally {
      setEntityLoading(false);
    }
  };

  // Counterpart to fetchWorksheetDetails's 404 fallback above, for the case where the
  // permission lookup itself 404s rather than silently returning an empty permission object.
  // Same walk-up-to-parent shape, driven by the hook's `error` instead of the entity fetch's
  // own catch. Mirrors ContainerPage.tsx's analogous permissionsError effect.
  useEffect(() => {
    if (!permissionsError) {
      return;
    }
    const status = (permissionsError as AxiosError | undefined)?.response
      ?.status;
    if (
      status === ClientErrors.NOT_FOUND &&
      !activeColumnFqn &&
      resolvedEntityFqn === decodedWorksheetFQN
    ) {
      const parentParts = Fqn.split(resolvedEntityFqn).slice(0, -1);
      if (parentParts.length > 0) {
        setActiveColumnFqn(resolvedEntityFqn);
        setResolvedEntityFqn(Fqn.build(...parentParts));

        return;
      }
    }
    showErrorToast(
      t('server.fetch-entity-permissions-error', { entity: resolvedEntityFqn })
    );
    setIsError(true);
  }, [
    permissionsError,
    activeColumnFqn,
    resolvedEntityFqn,
    decodedWorksheetFQN,
  ]);

  // Entity-fetch trigger — the counterpart to fetchWorksheetDetails above. Only fetches once
  // view permission for resolvedEntityFqn is confirmed granted; see
  // SpreadsheetDetailsPage.tsx's analogous effect.
  useEffect(() => {
    if (canViewBasic) {
      fetchWorksheetDetails(resolvedEntityFqn);
    }
  }, [canViewBasic, resolvedEntityFqn]);

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

  // Seeds resolvedEntityFqn on mount / URL FQN change (and, via the fallback effects above,
  // is walked up to a parent on a column deep-link's 404). Permission fetching itself now
  // lives in useEntityPermissions — this effect's only job is to commit the FQN that hook
  // and fetchWorksheetDetails both key off. Mirrors ContainerPage.tsx's analogous top-level
  // effect (unchanged in shape from the old fetchResourcePermission(decodedWorksheetFQN)
  // call this replaces).
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

    setActiveColumnFqn(undefined);
    setResolvedEntityFqn(decodedWorksheetFQN);
  }, [decodedWorksheetFQN, resolvedEntityFqn]);

  if (
    !resolvedEntityFqn ||
    isPermissionsLoading ||
    (canViewBasic && isEntityLoading)
  ) {
    return <PageLoader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('worksheet', decodedWorksheetFQN)}
      </ErrorPlaceHolder>
    );
  }
  if (!hasViewAccess) {
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
