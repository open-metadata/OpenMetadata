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
import { LeafNodes, LineagePos, LoadingNodeState } from 'Models';
import React, { Fragment, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getLineageByFQN } from '../../axiosAPIs/lineageAPI';
import { addLineage, deleteLineageEdge } from '../../axiosAPIs/miscAPI';
import { addFollower, getMlModelByFQN, patchMlModelDetails, removeFollower } from '../../axiosAPIs/mlModelAPI';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import { Edge, EdgeData } from '../../components/EntityLineage/EntityLineage.interface';
import Loader from '../../components/Loader/Loader';
import MlModelDetailComponent from '../../components/MlModelDetail/MlModelDetail.component';
import { getMlModelPath } from '../../constants/constants';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { EntityLineage, EntityReference } from '../../generated/type/entityLineage';
import jsonData from '../../jsons/en';
import { getCurrentUserId, getEntityMissingError } from '../../utils/CommonUtils';
import { getEntityLineage } from '../../utils/EntityUtils';
import { defaultFields, getCurrentMlModelTab, mlModelTabs } from '../../utils/MlModelDetailsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const MlModelPage = () => {
  const history = useHistory();
  const { mlModelFqn, tab } = useParams<{ [key: string]: string }>();
  const [mlModelDetail, setMlModelDetail] = useState<Mlmodel>({} as Mlmodel);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<number>(getCurrentMlModelTab(tab));
  const USERId = getCurrentUserId();

  const [entityLineage, setEntityLineage] = useState<EntityLineage>(
    {} as EntityLineage
  );
  const [leafNodes, setLeafNodes] = useState<LeafNodes>({} as LeafNodes);
  const [isNodeLoading, setNodeLoading] = useState<LoadingNodeState>({
    id: undefined,
    state: false,
  });
  const [isLineageLoading, setIsLineageLoading] = useState<boolean>(false);

  const getLineageData = () => {
    setIsLineageLoading(true);
    getLineageByFQN(mlModelDetail.fullyQualifiedName, EntityType.MLMODEL)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setEntityLineage(res.data);
        } else {
          showErrorToast(jsonData['api-error-messages']['fetch-lineage-error']);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-lineage-error']
        );
      })
      .finally(() => {
        setIsLineageLoading(false);
      });
  };

  const setLeafNode = (val: EntityLineage, pos: LineagePos) => {
    if (pos === 'to' && val.downstreamEdges?.length === 0) {
      setLeafNodes((prev) => ({
        ...prev,
        downStreamNode: [...(prev.downStreamNode ?? []), val.entity.id],
      }));
    }
    if (pos === 'from' && val.upstreamEdges?.length === 0) {
      setLeafNodes((prev) => ({
        ...prev,
        upStreamNode: [...(prev.upStreamNode ?? []), val.entity.id],
      }));
    }
  };

  const entityLineageHandler = (lineage: EntityLineage) => {
    setEntityLineage(lineage);
  };

  const loadNodeHandler = (node: EntityReference, pos: LineagePos) => {
    setNodeLoading({ id: node.id, state: true });
    getLineageByFQN(node.fullyQualifiedName, node.type)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setLeafNode(res.data, pos);
          setEntityLineage(getEntityLineage(entityLineage, res.data, pos));
        } else {
          showErrorToast(
            jsonData['api-error-messages']['fetch-lineage-node-error']
          );
        }
        setTimeout(() => {
          setNodeLoading((prev) => ({ ...prev, state: false }));
        }, 500);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-lineage-node-error']
        );
      });
  };

  const addLineageHandler = (edge: Edge): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      addLineage(edge)
        .then(() => {
          resolve();
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['add-lineage-error']
          );
          reject();
        });
    });
  };

  const removeLineageHandler = (data: EdgeData) => {
    deleteLineageEdge(
      data.fromEntity,
      data.fromId,
      data.toEntity,
      data.toId
    ).catch((err: AxiosError) => {
      showErrorToast(
        err,
        jsonData['api-error-messages']['delete-lineage-error']
      );
    });
  };

  const activeTabHandler = (tabValue: number) => {
    const currentTabIndex = tabValue - 1;
    if (mlModelTabs[currentTabIndex].path !== tab) {
      setActiveTab(getCurrentMlModelTab(mlModelTabs[currentTabIndex].path));
      history.push({
        pathname: getMlModelPath(mlModelFqn, mlModelTabs[currentTabIndex].path),
      });
    }
  };

  const fetchTabSpecificData = (tabField = '') => {
    switch (tabField) {
      case TabSpecificField.LINEAGE: {
        if (!isEmpty(mlModelDetail) && !mlModelDetail.deleted) {
          if (isEmpty(entityLineage)) {
            getLineageData();
          }

          break;
        }

        break;
      }

      default:
        break;
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

  const handleExtentionUpdate = async (updatedMlModel: Mlmodel) => {
    try {
      const response = await saveUpdatedMlModelData(updatedMlModel);
      const data = await response.data;
      if (data) {
        setMlModelDetail(data);
      } else {
        throw jsonData['api-error-messages']['update-entity-error'];
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['update-entity-error']
      );
    }
  };

  const getMlModelDetail = () => {
    if (!isNil(mlModelDetail) && !isEmpty(mlModelDetail)) {
      return (
        <MlModelDetailComponent
          activeTab={activeTab}
          descriptionUpdateHandler={descriptionUpdateHandler}
          followMlModelHandler={followMlModel}
          lineageTabData={{
            loadNodeHandler,
            addLineageHandler,
            removeLineageHandler,
            entityLineageHandler,
            isLineageLoading,
            entityLineage,
            lineageLeafNodes: leafNodes,
            isNodeLoading,
          }}
          mlModelDetail={mlModelDetail}
          setActiveTabHandler={activeTabHandler}
          settingsUpdateHandler={settingsUpdateHandler}
          tagUpdateHandler={onTagUpdate}
          unfollowMlModelHandler={unfollowMlModel}
          updateMlModelFeatures={updateMlModelFeatures}
          onExtensionUpdate={handleExtentionUpdate}
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
    fetchTabSpecificData(mlModelTabs[activeTab - 1].field);
  }, [activeTab, mlModelDetail]);

  useEffect(() => {
    fetchMlModelDetails(mlModelFqn);
  }, [mlModelFqn]);

  return (
    <Fragment>{isDetailLoading ? <Loader /> : getMlModelDetail()}</Fragment>
  );
};

export default observer(MlModelPage);
