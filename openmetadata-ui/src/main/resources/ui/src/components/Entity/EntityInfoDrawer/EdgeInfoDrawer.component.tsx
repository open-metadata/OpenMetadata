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

import { CloseOutlined } from '@ant-design/icons';
import { Col, Drawer, Row, Typography } from 'antd';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Node } from 'reactflow';
import DescriptionV1 from '../../../components/common/EntityDescription/DescriptionV1';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { LINEAGE_SOURCE } from '../../../constants/Lineage.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import { AddLineage } from '../../../generated/api/lineage/addLineage';
import { Source } from '../../../generated/type/entityLineage';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import {
  getColumnFunctionValue,
  getColumnSourceTargetHandles,
  getLineageDetailsObject,
} from '../../../utils/EntityLineageUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import Loader from '../../common/Loader/Loader';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import { ModalWithFunctionEditor } from '../../Modals/ModalWithFunctionEditor/ModalWithFunctionEditor';
import { ModalWithQueryEditor } from '../../Modals/ModalWithQueryEditor/ModalWithQueryEditor';
import './entity-info-drawer.less';
import {
  EdgeInfoDrawerInfo,
  EdgeInformationType,
} from './EntityInfoDrawer.interface';

const EdgeInfoDrawer = ({
  edge,
  visible,
  onClose,
  nodes,
  hasEditAccess,
  onEdgeDetailsUpdate,
}: EdgeInfoDrawerInfo) => {
  const [edgeData, setEdgeData] = useState<EdgeInformationType>();
  const [mysqlQuery, setMysqlQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSqlQueryModal, setShowSqlQueryModal] = useState(false);
  const [showSqlFunctionModal, setShowSqlFunctionModal] = useState(false);
  const [sqlFunction, setSqlFunction] = useState('');

  const { t } = useTranslation();

  const edgeEntity = useMemo(() => {
    return edge.data.edge;
  }, [edge]);

  const isColumnLineage = useMemo(() => {
    const { sourceHandle, targetHandle } = getColumnSourceTargetHandles(edge);

    return Boolean(sourceHandle && targetHandle);
  }, [edge]);

  const onDescriptionUpdate = useCallback(
    async (updatedHTML: string) => {
      if (edgeEntity?.description !== updatedHTML && edge) {
        const lineageDetails = {
          ...getLineageDetailsObject(edge),
          description: updatedHTML,
        };

        const updatedEdgeDetails = {
          edge: {
            fromEntity: {
              id: edgeEntity.fromEntity.id,
              type: edgeEntity.fromEntity.type,
            },
            toEntity: {
              id: edgeEntity.toEntity.id,
              type: edgeEntity.toEntity.type,
            },
            lineageDetails,
          },
        } as AddLineage;
        await onEdgeDetailsUpdate?.(updatedEdgeDetails);
      }
    },
    [edgeEntity, edge]
  );

  const onFunctionUpdate = useCallback(
    async (updatedFunction: string) => {
      if (edge) {
        const { sourceHandle, targetHandle } =
          getColumnSourceTargetHandles(edge);
        const updatedColumnLineage = [...(edgeEntity.columns || [])];

        // Find and update the function for the specific column connection
        const columnIndex = updatedColumnLineage.findIndex(
          (col) =>
            col.fromColumns.includes(sourceHandle) &&
            col.toColumn === targetHandle
        );

        if (columnIndex >= 0) {
          updatedColumnLineage[columnIndex] = {
            ...updatedColumnLineage[columnIndex],
            function: updatedFunction,
          };
          const lineageDetails = {
            ...getLineageDetailsObject(edge),
            columnsLineage: updatedColumnLineage,
          };

          const updatedEdgeDetails = {
            edge: {
              fromEntity: {
                id: edgeEntity.fromEntity.id,
                type: edgeEntity.fromEntity.type,
              },
              toEntity: {
                id: edgeEntity.toEntity.id,
                type: edgeEntity.toEntity.type,
              },
              lineageDetails,
            },
          } as AddLineage;

          await onEdgeDetailsUpdate?.(updatedEdgeDetails);
          setSqlFunction(updatedFunction);
          setShowSqlFunctionModal(false);
        }
      }
    },
    [edgeEntity, edge]
  );

  const edgeDetailsSection = useMemo(() => {
    const { data } = edge;
    const { sourceHandle, targetHandle } = getColumnSourceTargetHandles(edge);

    if (isColumnLineage) {
      const functionValue = getColumnFunctionValue(
        data?.edge?.columns ?? [],
        sourceHandle ?? '',
        targetHandle ?? ''
      );

      return (
        <Row
          className="p-md border-radius-card summary-panel-card"
          gutter={[0, 8]}>
          <Col span={24}>
            <div className="d-flex items-center m-b-xs gap-2">
              <Typography.Paragraph className="right-panel-label m-b-0">
                {`${t('label.sql-function')}`}
              </Typography.Paragraph>
              {hasEditAccess && (
                <EditIconButton
                  newLook
                  data-testid="edit-function"
                  size="small"
                  title={t('label.edit-entity', {
                    entity: t('label.sql-function'),
                  })}
                  onClick={() => {
                    setSqlFunction(functionValue ?? '');
                    setShowSqlFunctionModal(true);
                  }}
                />
              )}
            </div>
            <Typography.Text className="m-b-0" data-testid="sql-function">
              {functionValue ?? NO_DATA_PLACEHOLDER}
            </Typography.Text>
          </Col>
        </Row>
      );
    }

    return (
      <>
        <Row
          className="p-md border-radius-card summary-panel-card"
          gutter={[0, 8]}>
          <Col span={24}>
            <DescriptionV1
              description={edgeEntity?.description ?? ''}
              entityName="Edge"
              entityType={EntityType.LINEAGE_EDGE}
              hasEditAccess={hasEditAccess}
              showCommentsIcon={false}
              onDescriptionUpdate={onDescriptionUpdate}
            />
          </Col>
        </Row>
        <Row
          className="p-md border-radius-card summary-panel-card"
          gutter={[0, 8]}>
          <Col span={24}>
            <div className="d-flex items-center m-b-xs gap-2">
              <Typography.Paragraph className="right-panel-label m-b-0 ">
                {`${t('label.sql-uppercase-query')}`}
              </Typography.Paragraph>
              {hasEditAccess && (
                <EditIconButton
                  newLook
                  data-testid="edit-sql"
                  size="small"
                  title={t('label.edit-entity', {
                    entity: t('label.sql-uppercase-query'),
                  })}
                  onClick={() => setShowSqlQueryModal(true)}
                />
              )}
            </div>
            {mysqlQuery ? (
              <SchemaEditor
                className="edge-drawer-sql-editor"
                mode={{ name: CSMode.SQL }}
                options={{
                  styleActiveLine: false,
                  readOnly: 'nocursor',
                }}
                value={mysqlQuery}
              />
            ) : (
              <Typography.Paragraph className="m-b-0">
                {t('server.no-query-available')}
              </Typography.Paragraph>
            )}
          </Col>
        </Row>
        <Row
          className="p-md border-radius-card summary-panel-card"
          gutter={[0, 8]}>
          <Col span={24}>
            <div className="m-b-xs">
              <Typography.Paragraph className="right-panel-label m-b-0">
                {`${t('label.lineage-source')}`}
              </Typography.Paragraph>
            </div>
            <Typography.Text className="m-b-0">
              {LINEAGE_SOURCE[edgeEntity.source as keyof typeof Source]}
            </Typography.Text>
          </Col>
        </Row>
      </>
    );
  }, [
    isColumnLineage,
    edgeEntity?.description,
    hasEditAccess,
    edgeEntity.source,
    mysqlQuery,
    onDescriptionUpdate,
    edge,
    sqlFunction,
  ]);

  const getEdgeInfo = () => {
    const { source, target, data } = edge;
    const { sourceHandle, targetHandle } = getColumnSourceTargetHandles(edge);
    const { pipeline, pipelineEntityType } = data?.edge ?? {};

    let sourceData: Node | undefined, targetData: Node | undefined;
    nodes.forEach((node) => {
      if (source === node.id) {
        sourceData = node;
      } else if (target === node.id) {
        targetData = node;
      }
    });

    const {
      entityType: sourceEntityType = '',
      fullyQualifiedName: sourceFqn = '',
    } = sourceData?.data?.node ?? {};

    const {
      entityType: targetEntityType = '',
      fullyQualifiedName: targetFqn = '',
    } = targetData?.data?.node ?? {};

    setEdgeData({
      sourceData: {
        key: t('label.source'),
        value: sourceData && getEntityName(sourceData?.data?.node),
        link:
          sourceData &&
          entityUtilClassBase.getEntityLink(sourceEntityType, sourceFqn),
      },
      sourceColumn: {
        key: t('label.source-column'),
        value: sourceHandle ? getNameFromFQN(sourceHandle) : undefined,
      },
      targetData: {
        key: t('label.target'),
        value: targetData ? getEntityName(targetData?.data?.node) : undefined,
        link:
          targetData &&
          entityUtilClassBase.getEntityLink(targetEntityType, targetFqn),
      },
      targetColumn: {
        key: t('label.target-column'),
        value: targetHandle ? getNameFromFQN(targetHandle) : undefined,
      },
      pipeline: {
        key: t('label.edge'),
        value: pipeline ? getEntityName(pipeline) : undefined,
        link:
          pipeline &&
          entityUtilClassBase.getEntityLink(
            pipelineEntityType,
            pipeline.fullyQualifiedName
          ),
      },
    });
    setIsLoading(false);
  };

  const onSqlQueryUpdate = useCallback(
    async (updatedQuery: string) => {
      if (mysqlQuery !== updatedQuery && edge) {
        const lineageDetails = {
          ...getLineageDetailsObject(edge),
          sqlQuery: updatedQuery,
        };

        const updatedEdgeDetails = {
          edge: {
            fromEntity: {
              id: edgeEntity.fromEntity.id,
              type: edgeEntity.fromEntity.type,
            },
            toEntity: {
              id: edgeEntity.toEntity.id,
              type: edgeEntity.toEntity.type,
            },
            lineageDetails,
          },
        } as AddLineage;
        await onEdgeDetailsUpdate?.(updatedEdgeDetails);
        setMysqlQuery(updatedQuery);
      }
      setShowSqlQueryModal(false);
    },
    [edgeEntity, edge, mysqlQuery]
  );

  useEffect(() => {
    setIsLoading(true);
    getEdgeInfo();
    setMysqlQuery(edge.data.edge?.sqlQuery);
  }, [edge, visible]);

  return (
    <>
      <Drawer
        destroyOnClose
        bodyStyle={{ padding: 16 }}
        className="entity-panel-container edge-info-drawer"
        closable={false}
        extra={<CloseOutlined onClick={onClose} />}
        getContainer={false}
        headerStyle={{ padding: 16 }}
        mask={false}
        open={visible}
        style={{ position: 'absolute' }}
        title={t('label.edge-information')}>
        {isLoading ? (
          <Loader />
        ) : (
          <>
            {edgeData && (
              <div className="d-flex gap-5 flex-col">
                <Row
                  className="p-md border-radius-card summary-panel-card"
                  gutter={[0, 8]}>
                  {Object.values(edgeData).map(
                    (data) =>
                      data.value && (
                        <Col data-testid={data.key} key={data.key} span={24}>
                          <Typography.Text className="m-r-sm font-semibold">
                            {`${data.key}:`}
                          </Typography.Text>

                          {isUndefined(data.link) ? (
                            <Typography.Text>{data.value}</Typography.Text>
                          ) : (
                            <Link to={data.link}>{data.value}</Link>
                          )}
                        </Col>
                      )
                  )}
                </Row>
                {edgeDetailsSection}
              </div>
            )}
          </>
        )}
      </Drawer>
      {showSqlQueryModal && (
        <ModalWithQueryEditor
          header={t('label.edit-entity', {
            entity: t('label.sql-uppercase-query'),
          })}
          value={mysqlQuery ?? ''}
          visible={showSqlQueryModal}
          onCancel={() => setShowSqlQueryModal(false)}
          onSave={onSqlQueryUpdate}
        />
      )}
      {showSqlFunctionModal && (
        <ModalWithFunctionEditor
          header={t('label.edit-entity', {
            entity: t('label.sql-function'),
          })}
          value={sqlFunction}
          visible={showSqlFunctionModal}
          onCancel={() => setShowSqlFunctionModal(false)}
          onSave={onFunctionUpdate}
        />
      )}
    </>
  );
};

export default EdgeInfoDrawer;
