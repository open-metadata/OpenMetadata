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
import { isEmpty, isNil, isUndefined, omitBy, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import MlModelDetailComponent from '../../components/MlModel/MlModelDetail/MlModelDetail.component';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  addFollower,
  getMlModelByFQN,
  patchMlModelDetails,
  removeFollower,
  updateMlModelVotes,
} from '../../rest/mlModelAPI';
import {
  addToRecentViewed,
  getEntityMissingError,
} from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { defaultFields } from '../../utils/MlModelDetailsUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const MlModelPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const navigate = useNavigate();
  const { fqn: mlModelFqn } = useFqn();
  const [mlModelDetail, setMlModelDetail] = useState<Mlmodel>({} as Mlmodel);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const USERId = currentUser?.id ?? '';

  const [mlModelPermissions, setPipelinePermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { getEntityPermissionByFqn } = usePermissionProvider();

  const fetchResourcePermission = async (entityFqn: string) => {
    setIsDetailLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.ML_MODEL,
        entityFqn
      );
      setPipelinePermissions(entityPermission);
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: entityFqn,
        })
      );
    } finally {
      setIsDetailLoading(false);
    }
  };

  const viewUsagePermission = useMemo(
    () => mlModelPermissions.ViewAll || mlModelPermissions.ViewUsage,
    [mlModelPermissions]
  );

  const fetchMlModelDetails = async (name: string) => {
    setIsDetailLoading(true);
    try {
      let fields = defaultFields;
      if (viewUsagePermission) {
        fields += `,${TabSpecificField.USAGE_SUMMARY}`;
      }
      const res = await getMlModelByFQN(name, { fields });
      setMlModelDetail(res);
      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.MLMODEL,
        fqn: res.fullyQualifiedName ?? '',
        serviceType: res.serviceType,
        timestamp: 0,
        id: res.id,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
      if ((error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN) {
        navigate(ROUTES.FORBIDDEN, { replace: true });
      }
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    if (mlModelPermissions.ViewAll || mlModelPermissions.ViewBasic) {
      fetchMlModelDetails(mlModelFqn);
    }
  }, [mlModelPermissions, mlModelFqn]);

  const saveUpdatedMlModelData = useCallback(
    (updatedData: Mlmodel) => {
      const jsonPatch = compare(
        omitBy(mlModelDetail, isUndefined),
        updatedData
      );

      return patchMlModelDetails(mlModelDetail.id, jsonPatch);
    },
    [mlModelDetail]
  );

  const followMlModel = async () => {
    try {
      const res = await addFollower(mlModelDetail.id, USERId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        followers: [...(mlModelDetail.followers || []), ...newValue],
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(mlModelDetail),
        })
      );
    }
  };

  const unFollowMlModel = async () => {
    try {
      const res = await removeFollower(mlModelDetail.id, USERId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        followers: (mlModelDetail.followers ?? []).filter(
          (follower) => follower.id !== oldValue[0].id
        ),
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(mlModelDetail),
        })
      );
    }
  };

  const settingsUpdateHandler = async (
    updatedMlModel: Mlmodel
  ): Promise<void> => {
    try {
      const { displayName, owners, tags, version } =
        await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        displayName,
        owners,
        tags,
        version,
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: getEntityName(mlModelDetail),
        })
      );
    }
  };

  const versionHandler = () => {
    navigate(
      getVersionPath(
        EntityType.MLMODEL,
        mlModelFqn,
        toString(mlModelDetail.version)
      )
    );
  };

  const handleToggleDelete = (version?: number) => {
    setMlModelDetail((prev) => {
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
      await updateMlModelVotes(id, data);
      const details = await getMlModelByFQN(mlModelFqn, {
        fields: defaultFields,
      });
      setMlModelDetail(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateMlModelDetailsState = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as Mlmodel;

      setMlModelDetail((data) => ({
        ...(updatedData ?? data),
        version: updatedData.version,
      }));
    },
    []
  );

  const handleMlModelUpdate = useCallback(
    async (data: Mlmodel) => {
      try {
        const response = await saveUpdatedMlModelData(data);
        setMlModelDetail((prev) => ({
          ...prev,
          ...response,
        }));
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: getEntityName(mlModelDetail),
          })
        );
      }
    },
    [saveUpdatedMlModelData]
  );
  const onMlModelUpdateCertification = async (
    updatedMlModel: Mlmodel,
    key?: keyof Mlmodel
  ) => {
    try {
      const response = await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail((previous) => {
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

  useEffect(() => {
    fetchResourcePermission(mlModelFqn);
  }, [mlModelFqn]);

  if (isDetailLoading) {
    return <Loader />;
  }

  if (isNil(mlModelDetail) || isEmpty(mlModelDetail)) {
    return (
      <ErrorPlaceHolder className="mt-0-important">
        {getEntityMissingError('mlModel', mlModelFqn)}
      </ErrorPlaceHolder>
    );
  }

  if (!mlModelPermissions.ViewAll && !mlModelPermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.ml-model'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <MlModelDetailComponent
      fetchMlModel={() => fetchMlModelDetails(mlModelFqn)}
      followMlModelHandler={followMlModel}
      handleToggleDelete={handleToggleDelete}
      mlModelDetail={mlModelDetail}
      settingsUpdateHandler={settingsUpdateHandler}
      unFollowMlModelHandler={unFollowMlModel}
      updateMlModelDetailsState={updateMlModelDetailsState}
      versionHandler={versionHandler}
      onMlModelUpdate={handleMlModelUpdate}
      onMlModelUpdateCertification={onMlModelUpdateCertification}
      onUpdateVote={updateVote}
    />
  );
};

export default MlModelPage;
