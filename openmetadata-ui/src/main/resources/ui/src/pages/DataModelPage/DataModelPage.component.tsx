/*
 *  Copyright 2023 Collate.
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
import { isUndefined, omitBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import DataModelDetails from '../../components/Dashboard/DataModel/DataModels/DataModelDetails.component';
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
import { Tag } from '../../generated/entity/classification/tag';
import { DashboardDataModel } from '../../generated/entity/data/dashboardDataModel';
import { Include } from '../../generated/type/include';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  addDataModelFollower,
  getDataModelByFqn,
  patchDataModelDetails,
  removeDataModelFollower,
  updateDataModelVotes,
} from '../../rest/dataModelsAPI';
import {
  addToRecentViewed,
  getEntityMissingError,
} from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getTierTags } from '../../utils/TableUtils';
import { updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const DataModelsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { fqn: dashboardDataModelFQN } = useFqn();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [dataModelPermissions, setDataModelPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [dataModelData, setDataModelData] = useState<DashboardDataModel>(
    {} as DashboardDataModel
  );

  const { hasViewPermission } = useMemo(() => {
    return {
      hasViewPermission:
        dataModelPermissions.ViewAll || dataModelPermissions.ViewBasic,
    };
  }, [dataModelPermissions]);

  const { isUserFollowing } = useMemo(() => {
    return {
      tier: getTierTags(dataModelData?.tags ?? []),
      isUserFollowing: dataModelData?.followers?.some(
        ({ id }: { id: string }) => id === currentUser?.id
      ),
    };
  }, [dataModelData, currentUser]);

  const fetchResourcePermission = async (dashboardDataModelFQN: string) => {
    setIsLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.DASHBOARD_DATA_MODEL,
        dashboardDataModelFQN
      );
      setDataModelPermissions(entityPermission);
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.asset-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDataModelDetails = async (dashboardDataModelFQN: string) => {
    setIsLoading(true);
    try {
      const response = await getDataModelByFqn(dashboardDataModelFQN, {
        // eslint-disable-next-line max-len
        fields: `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.FOLLOWERS},${TabSpecificField.VOTES},${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS},${TabSpecificField.EXTENSION}`,
        include: Include.All,
      });
      setDataModelData(response);

      addToRecentViewed({
        displayName: getEntityName(response),
        entityType: EntityType.DASHBOARD_DATA_MODEL,
        fqn: response.fullyQualifiedName ?? '',
        serviceType: response.serviceType,
        timestamp: 0,
        id: response.id,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
      setHasError(true);
      if ((error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN) {
        navigate(ROUTES.FORBIDDEN);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateDataModelData = (updatedData: DashboardDataModel) => {
    const jsonPatch = compare(omitBy(dataModelData, isUndefined), updatedData);

    return patchDataModelDetails(dataModelData?.id ?? '', jsonPatch);
  };

  const handleFollowDataModel = async () => {
    const followerId = currentUser?.id ?? '';
    const dataModelId = dataModelData?.id ?? '';
    try {
      if (isUserFollowing) {
        const response = await removeDataModelFollower(dataModelId, followerId);
        const { oldValue } = response.changeDescription.fieldsDeleted[0];

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          followers: (dataModelData?.followers || []).filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        }));
      } else {
        const response = await addDataModelFollower(dataModelId, followerId);
        const { newValue } = response.changeDescription.fieldsAdded[0];

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          followers: [...(dataModelData?.followers ?? []), ...newValue],
        }));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateOwner = useCallback(
    async (updatedOwners?: DashboardDataModel['owners']) => {
      try {
        const { owners: newOwners, version } = await handleUpdateDataModelData({
          ...(dataModelData as DashboardDataModel),
          owners: updatedOwners,
        });

        setDataModelData((prev) => ({
          ...(prev as DashboardDataModel),
          owners: newOwners,
          version,
        }));
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [dataModelData, dataModelData?.owners]
  );

  const handleUpdateTier = async (updatedTier?: Tag) => {
    try {
      const tags = updateTierTag(dataModelData?.tags ?? [], updatedTier);
      const { tags: newTags, version } = await handleUpdateDataModelData({
        ...(dataModelData as DashboardDataModel),
        tags,
      });

      setDataModelData((prev) => ({
        ...(prev as DashboardDataModel),
        tags: newTags,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateDataModel = async (
    updatedDataModel: DashboardDataModel,
    key?: keyof DashboardDataModel
  ) => {
    try {
      const response = await handleUpdateDataModelData(updatedDataModel);

      setDataModelData(() => ({
        ...response,
        ...(key && { [key]: response[key] }),
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleToggleDelete = (version?: number) => {
    setDataModelData((prev) => {
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
      await updateDataModelVotes(id, data);
      const details = await getDataModelByFqn(
        dashboardDataModelFQN,

        {
          fields: [
            TabSpecificField.OWNERS,
            TabSpecificField.TAGS,
            TabSpecificField.FOLLOWERS,
            TabSpecificField.VOTES,
            TabSpecificField.DOMAIN,
            TabSpecificField.DATA_PRODUCTS,
          ],
          include: Include.All,
        }
      );
      setDataModelData(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateDataModelDetailsState = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as DashboardDataModel;

      setDataModelData((data) => ({
        ...(updatedData ?? data),
        version: updatedData.version,
      }));
    },
    []
  );

  useEffect(() => {
    if (hasViewPermission) {
      fetchDataModelDetails(dashboardDataModelFQN);
    }
  }, [dashboardDataModelFQN, dataModelPermissions]);

  useEffect(() => {
    fetchResourcePermission(dashboardDataModelFQN);
  }, [dashboardDataModelFQN]);

  // Rendering
  if (isLoading) {
    return <Loader />;
  }

  if (hasError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(t('label.data-model'), dashboardDataModelFQN)}
      </ErrorPlaceHolder>
    );
  }

  if (!hasViewPermission && !isLoading) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.data-model'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <DataModelDetails
      dataModelData={dataModelData}
      dataModelPermissions={dataModelPermissions}
      fetchDataModel={() => fetchDataModelDetails(dashboardDataModelFQN)}
      handleFollowDataModel={handleFollowDataModel}
      handleToggleDelete={handleToggleDelete}
      handleUpdateOwner={handleUpdateOwner}
      handleUpdateTier={handleUpdateTier}
      updateDataModelDetailsState={updateDataModelDetailsState}
      onUpdateDataModel={handleUpdateDataModel}
      onUpdateVote={updateVote}
    />
  );
};

export default DataModelsPage;
