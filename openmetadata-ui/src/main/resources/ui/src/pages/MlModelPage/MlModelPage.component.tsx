/*
 *  Copyright 2021 Collate
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

import { AxiosError, AxiosResponse } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, isNil } from 'lodash';
import { observer } from 'mobx-react';
import React, { Fragment, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  addFollower,
  getMlModelByFQN,
  patchMlModelDetails,
  removeFollower,
} from '../../axiosAPIs/mlModelAPI';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import Loader from '../../components/Loader/Loader';
import MlModelDetailComponent from '../../components/MlModelDetail/MlModelDetail.component';
import { getMlModelPath } from '../../constants/constants';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import jsonData from '../../jsons/en';
import {
  getCurrentUserId,
  getEntityMissingError,
} from '../../utils/CommonUtils';
import {
  defaultFields,
  getCurrentMlModelTab,
  mlModelTabs,
} from '../../utils/MlModelDetailsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const MlModelPage = () => {
  const history = useHistory();
  const { mlModelFqn, tab } = useParams<{ [key: string]: string }>();
  const [mlModelDetail, setMlModelDetail] = useState<Mlmodel>({} as Mlmodel);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(getCurrentMlModelTab(tab));
  const USERId = getCurrentUserId();

  const activeTabHandler = (tabValue: number) => {
    const currentTabIndex = tabValue - 1;
    if (mlModelTabs[currentTabIndex].path !== tab) {
      setActiveTab(getCurrentMlModelTab(mlModelTabs[currentTabIndex].path));
      history.push({
        pathname: getMlModelPath(mlModelFqn, mlModelTabs[currentTabIndex].path),
      });
    }
  };

  const fetchMlModelDetails = (name: string) => {
    setIsDetailLoading(true);
    getMlModelByFQN(name, defaultFields)
      .then((response: AxiosResponse) => {
        const mlModelData = response.data;
        if (mlModelData) {
          setMlModelDetail(mlModelData);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      })
      .finally(() => {
        setIsDetailLoading(false);
      });
  };

  const saveUpdatedMlModelData = (
    updatedData: Mlmodel
  ): Promise<AxiosResponse> => {
    const jsonPatch = compare(mlModelDetail, updatedData);

    return patchMlModelDetails(
      mlModelDetail.id,
      jsonPatch
    ) as unknown as Promise<AxiosResponse>;
  };

  const descriptionUpdateHandler = (updatedMlModel: Mlmodel) => {
    saveUpdatedMlModelData(updatedMlModel)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { description } = res.data;
          setMlModelDetail((preVDetail) => ({
            ...preVDetail,
            description: description,
          }));
        } else {
          throw jsonData['api-error-messages']['update-description-error'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-description-error']
        );
      });
  };

  const followMlModel = () => {
    addFollower(mlModelDetail.id, USERId)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { newValue } = res.data.changeDescription.fieldsAdded[0];

          setMlModelDetail((preVDetail) => ({
            ...preVDetail,
            followers: [...(mlModelDetail.followers || []), ...newValue],
          }));
        } else {
          throw jsonData['api-error-messages']['update-entity-follow-error'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-follow-error']
        );
      });
  };

  const unfollowMlModel = () => {
    removeFollower(mlModelDetail.id, USERId)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { oldValue } = res.data.changeDescription.fieldsDeleted[0];
          setMlModelDetail((preVDetail) => ({
            ...preVDetail,
            followers: (mlModelDetail.followers || []).filter(
              (follower) => follower.id !== oldValue[0].id
            ),
          }));
        } else {
          showErrorToast(
            jsonData['api-error-messages']['update-entity-unfollow-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-unfollow-error']
        );
      });
  };

  const onTagUpdate = (updatedMlModel: Mlmodel) => {
    saveUpdatedMlModelData(updatedMlModel)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setMlModelDetail((preVDetail) => ({
            ...preVDetail,
            tags: res.data.tags,
          }));
        } else {
          throw jsonData['api-error-messages']['update-tags-error'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-tags-error']
        );
      });
  };

  const settingsUpdateHandler = (updatedMlModel: Mlmodel): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      saveUpdatedMlModelData(updatedMlModel)
        .then((res) => {
          if (res.data) {
            setMlModelDetail((preVDetail) => ({
              ...preVDetail,
              owner: res.data.owner,
              tags: res.data.tags,
            }));
            resolve();
          } else {
            showErrorToast(
              jsonData['api-error-messages']['update-entity-error']
            );
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-entity-error']
          );
          reject();
        });
    });
  };

  const updateMlModelFeatures = (updatedMlModel: Mlmodel) => {
    saveUpdatedMlModelData(updatedMlModel)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setMlModelDetail((preVDetail) => ({
            ...preVDetail,
            mlFeatures: res.data.mlFeatures,
          }));
        } else {
          throw jsonData['api-error-messages']['unexpected-error'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  };

  const getMlModelDetail = () => {
    if (!isNil(mlModelDetail) && !isEmpty(mlModelDetail)) {
      return (
        <MlModelDetailComponent
          activeTab={activeTab}
          descriptionUpdateHandler={descriptionUpdateHandler}
          followMlModelHandler={followMlModel}
          mlModelDetail={mlModelDetail}
          setActiveTabHandler={activeTabHandler}
          settingsUpdateHandler={settingsUpdateHandler}
          tagUpdateHandler={onTagUpdate}
          unfollowMlModelHandler={unfollowMlModel}
          updateMlModelFeatures={updateMlModelFeatures}
        />
      );
    } else {
      return (
        <ErrorPlaceHolder>
          {getEntityMissingError('mlModel', mlModelFqn)}
        </ErrorPlaceHolder>
      );
    }
  };

  useEffect(() => {
    fetchMlModelDetails(mlModelFqn);
  }, [mlModelFqn]);

  return (
    <Fragment>{isDetailLoading ? <Loader /> : getMlModelDetail()}</Fragment>
  );
};

export default observer(MlModelPage);
