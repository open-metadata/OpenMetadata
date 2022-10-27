/*
 *  Copyright 2022 Collate
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

import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { LeafNodes, LineagePos, LoadingNodeState } from 'Models';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getLineageByFQN } from '../../axiosAPIs/lineageAPI';
import { addLineage, deleteLineageEdge } from '../../axiosAPIs/miscAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import EntityLineageComponent from '../../components/EntityLineage/EntityLineage.component';
import {
  Edge,
  EdgeData,
} from '../../components/EntityLineage/EntityLineage.interface';
import { EntityType } from '../../enums/entity.enum';
import {
  EntityLineage,
  EntityReference,
} from '../../generated/type/entityLineage';
import jsonData from '../../jsons/en';
import { getEntityLineage } from '../../utils/EntityUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const LineagePage = () => {
  const { entityType, entityFQN } =
    useParams<{ entityType: EntityType; entityFQN: string }>();
  const [isLineageLoading, setIsLineageLoading] = useState<boolean>(false);
  const [leafNodes, setLeafNodes] = useState<LeafNodes>({} as LeafNodes);
  const [entityLineage, setEntityLineage] = useState<EntityLineage>(
    {} as EntityLineage
  );
  const [isNodeLoading, setIsNodeLoading] = useState<LoadingNodeState>({
    id: undefined,
    state: false,
  });

  const getLineageData = async () => {
    setIsLineageLoading(true);

    try {
      const res = await getLineageByFQN(entityFQN, entityType);
      setEntityLineage(res);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-lineage-error']
      );
    } finally {
      setIsLineageLoading(false);
    }
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
    setIsNodeLoading({ id: node.id, state: true });
    getLineageByFQN(node.fullyQualifiedName ?? '', node.type)
      .then((res) => {
        if (res) {
          setLeafNode(res, pos);
          setEntityLineage(getEntityLineage(entityLineage, res, pos));
        } else {
          showErrorToast(
            jsonData['api-error-messages']['fetch-lineage-node-error']
          );
        }
        setTimeout(() => {
          setIsNodeLoading((prev) => ({ ...prev, state: false }));
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

  useEffect(() => {
    if (entityFQN && entityType) {
      getLineageData();
    }
  }, [entityFQN, entityType]);

  return (
    <PageContainerV1>
      <PageLayoutV1 className="h-full p-x-lg">
        <Row className="h-full" gutter={[16, 16]}>
          <Col className="tw-bg-white" span={24}>
            <div className="p-lg h-full">
              <EntityLineageComponent
                hasEditAccess
                addLineageHandler={addLineageHandler}
                entityLineage={entityLineage}
                entityLineageHandler={entityLineageHandler}
                entityType={entityType}
                isLoading={isLineageLoading}
                isNodeLoading={isNodeLoading}
                lineageLeafNodes={leafNodes}
                loadNodeHandler={loadNodeHandler}
                removeLineageHandler={removeLineageHandler}
              />
            </div>
          </Col>
        </Row>
      </PageLayoutV1>
    </PageContainerV1>
  );
};

export default LineagePage;
