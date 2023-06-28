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
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import Loader from 'components/Loader/Loader';
import MlModelDetailComponent from 'components/MlModelDetail/MlModelDetail.component';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { compare } from 'fast-json-patch';
import { isEmpty, isNil, isUndefined, omitBy } from 'lodash';
import { observer } from 'mobx-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { postThread } from 'rest/feedsAPI';
import {
  addFollower,
  getMlModelByFQN,
  patchMlModelDetails,
  removeFollower,
} from 'rest/mlModelAPI';
import { getVersionPath } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import {
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
  const { mlModelFqn } = useParams<{ [key: string]: string }>();
  const [mlModelDetail, setMlModelDetail] = useState<Mlmodel>({} as Mlmodel);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const USERId = getCurrentUserId();

  const [mlModelPermissions, setPipelinePermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const [currentVersion, setCurrentVersion] = useState<string>();

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

  const fetchMlModelDetails = async (name: string) => {
    setIsDetailLoading(true);
    try {
      const res = await getMlModelByFQN(name, defaultFields);
      setMlModelDetail(res);
      setCurrentVersion(res.version?.toString());
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
      setCurrentVersion(version?.toString());
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        description: description,
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
      const res = await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        tags: sortTagsCaseInsensitive(res.tags ?? []),
      }));
      setCurrentVersion(res.version?.toString());
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
      const res = await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        displayName: res.displayName,
        owner: res.owner,
        tags: res.tags,
      }));
      setCurrentVersion(res.version?.toString());
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
      const response = await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        mlFeatures: response.mlFeatures,
      }));
      setCurrentVersion(response.version?.toString());
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleExtensionUpdate = async (updatedMlModel: Mlmodel) => {
    try {
      const data = await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail(data);
      setCurrentVersion(data.version?.toString());
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
      getVersionPath(EntityType.MLMODEL, mlModelFqn, currentVersion as string)
    );
  };

  useEffect(() => {
    fetchResourcePermission(mlModelFqn);
  }, [mlModelFqn]);

  if (isDetailLoading) {
    return <Loader />;
  }

  if (isNil(mlModelDetail) || isEmpty(mlModelDetail)) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('mlModel', mlModelFqn)}
      </ErrorPlaceHolder>
    );
  }

  if (!mlModelPermissions.ViewAll && !mlModelPermissions.ViewBasic) {
    return (
      <ErrorPlaceHolder
        className="mt-24"
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <MlModelDetailComponent
      createThread={createThread}
      descriptionUpdateHandler={descriptionUpdateHandler}
      followMlModelHandler={followMlModel}
      mlModelDetail={mlModelDetail}
      settingsUpdateHandler={settingsUpdateHandler}
      tagUpdateHandler={onTagUpdate}
      unFollowMlModelHandler={unFollowMlModel}
      updateMlModelFeatures={updateMlModelFeatures}
      version={currentVersion}
      versionHandler={versionHandler}
      onExtensionUpdate={handleExtensionUpdate}
    />
  );
};

export default observer(MlModelPage);
