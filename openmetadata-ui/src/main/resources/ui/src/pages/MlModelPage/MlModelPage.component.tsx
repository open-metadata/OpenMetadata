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
import { observer } from 'mobx-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import Loader from '../../components/Loader/Loader';
import MlModelDetailComponent from '../../components/MlModelDetail/MlModelDetail.component';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../components/PermissionProvider/PermissionProvider.interface';
import { QueryVote } from '../../components/TableQueries/TableQueries.interface';
import { getVersionPath } from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { postThread } from '../../rest/feedsAPI';
import {
  addFollower,
  getMlModelByFQN,
  patchMlModelDetails,
  removeFollower,
  updateMlModelVotes,
} from '../../rest/mlModelAPI';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
  sortTagsCaseInsensitive,
} from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { defaultFields } from '../../utils/MlModelDetailsUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const MlModelPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn: mlModelFqn } = useParams<{ fqn: string }>();
  const [mlModelDetail, setMlModelDetail] = useState<Mlmodel>({} as Mlmodel);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const USERId = getCurrentUserId();

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
    } catch (error) {
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
      const res = await getMlModelByFQN(name, fields);
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
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    if (mlModelPermissions.ViewAll || mlModelPermissions.ViewBasic) {
      fetchMlModelDetails(mlModelFqn);
    }
  }, [mlModelPermissions, mlModelFqn]);

  const saveUpdatedMlModelData = (updatedData: Mlmodel) => {
    const jsonPatch = compare(omitBy(mlModelDetail, isUndefined), updatedData);

    return patchMlModelDetails(mlModelDetail.id, jsonPatch);
  };

  const descriptionUpdateHandler = async (updatedMlModel: Mlmodel) => {
    try {
      const response = await saveUpdatedMlModelData(updatedMlModel);
      const { description, version } = response;
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        description,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

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

  const onTagUpdate = async (updatedMlModel: Mlmodel) => {
    try {
      const { tags, version } = await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        tags: sortTagsCaseInsensitive(tags ?? []),
        version: version,
      }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: t('label.tag-plural'),
        })
      );
    }
  };

  const settingsUpdateHandler = async (
    updatedMlModel: Mlmodel
  ): Promise<void> => {
    try {
      const { displayName, owner, tags, version } =
        await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        displayName,
        owner,
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

  const updateMlModelFeatures = async (updatedMlModel: Mlmodel) => {
    try {
      const { mlFeatures, version } = await saveUpdatedMlModelData(
        updatedMlModel
      );
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        mlFeatures,
        version,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleExtensionUpdate = async (updatedMlModel: Mlmodel) => {
    try {
      const data = await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail(data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: getEntityName(mlModelDetail),
        })
      );
    }
  };

  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };

  const versionHandler = () => {
    history.push(
      getVersionPath(
        EntityType.MLMODEL,
        mlModelFqn,
        toString(mlModelDetail.version)
      )
    );
  };

  const handleToggleDelete = () => {
    setMlModelDetail((prev) => {
      if (!prev) {
        return prev;
      }

      return { ...prev, deleted: !prev?.deleted };
    });
  };

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateMlModelVotes(id, data);
      const details = await getMlModelByFQN(mlModelFqn, defaultFields);
      setMlModelDetail(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateMlModelDetailsState = useCallback((data) => {
    const updatedData = data as Mlmodel;

    setMlModelDetail((data) => ({
      ...(data ?? updatedData),
      version: updatedData.version,
    }));
  }, []);

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
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <MlModelDetailComponent
      createThread={createThread}
      descriptionUpdateHandler={descriptionUpdateHandler}
      fetchMlModel={() => fetchMlModelDetails(mlModelFqn)}
      followMlModelHandler={followMlModel}
      handleToggleDelete={handleToggleDelete}
      mlModelDetail={mlModelDetail}
      settingsUpdateHandler={settingsUpdateHandler}
      tagUpdateHandler={onTagUpdate}
      unFollowMlModelHandler={unFollowMlModel}
      updateMlModelDetailsState={updateMlModelDetailsState}
      updateMlModelFeatures={updateMlModelFeatures}
      versionHandler={versionHandler}
      onExtensionUpdate={handleExtensionUpdate}
      onUpdateVote={updateVote}
    />
  );
};

export default observer(MlModelPage);
