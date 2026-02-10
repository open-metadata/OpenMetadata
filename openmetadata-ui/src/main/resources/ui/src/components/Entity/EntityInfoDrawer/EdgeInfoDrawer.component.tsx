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

import { CloseOutlined } from '@mui/icons-material';
import { GitMerge } from '@untitledui/icons';
import { Button, Tooltip, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import DescriptionSection from '../../../components/common/DescriptionSection/DescriptionSection';
import OverviewSection from '../../../components/common/OverviewSection/OverviewSection';
import SectionWithEdit from '../../../components/common/SectionWithEdit/SectionWithEdit';
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
import Loader from '../../common/Loader/Loader';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import { ModalWithFunctionEditor } from '../../Modals/ModalWithFunctionEditor/ModalWithFunctionEditor';
import { ModalWithQueryEditor } from '../../Modals/ModalWithQueryEditor/ModalWithQueryEditor';
import './entity-info-drawer.less';
import { EdgeInfoDrawerInfo } from './EntityInfoDrawer.interface';

const EdgeInfoDrawer = ({
  edge,
  visible,
  onClose,
  nodes,
  hasEditAccess,
  onEdgeDetailsUpdate,
}: EdgeInfoDrawerInfo) => {
  const [edgeData, setEdgeData] = useState<
    Array<{
      name: string;
      value?: unknown;
      url?: string;
      isLink?: boolean;
      visible?: string[];
    }>
  >([]);
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
        <SectionWithEdit
          className="summary-panel-card sql-function-section"
          showEditButton={hasEditAccess}
          title={t('label.sql-function')}
          onEdit={() => {
            setSqlFunction(functionValue ?? '');
            setShowSqlFunctionModal(true);
          }}>
          <Typography.Text className="m-b-0" data-testid="sql-function">
            {functionValue ?? NO_DATA_PLACEHOLDER}
          </Typography.Text>
        </SectionWithEdit>
      );
    }

    return (
      <>
        <SectionWithEdit
          className="summary-panel-card"
          showEditButton={hasEditAccess}
          title={t('label.sql-uppercase-query')}
          onEdit={() => setShowSqlQueryModal(true)}>
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
        </SectionWithEdit>
        <SectionWithEdit
          className="summary-panel-card"
          showEditButton={false}
          title={t('label.lineage-source')}>
          <Typography.Text className="lineage-source-text">
            {LINEAGE_SOURCE[edgeEntity.source as keyof typeof Source]}
          </Typography.Text>
        </SectionWithEdit>
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

    const overviewData = [];

    if (sourceData) {
      overviewData.push({
        name: t('label.source'),
        value: getEntityName(sourceData?.data?.node),
        url: entityUtilClassBase.getEntityLink(sourceEntityType, sourceFqn),
        isLink: true,
      });
    }

    if (sourceHandle) {
      overviewData.push({
        name: t('label.source-column'),
        value: getNameFromFQN(sourceHandle),
      });
    }

    if (targetData) {
      overviewData.push({
        name: t('label.target'),
        value: getEntityName(targetData?.data?.node),
        url: entityUtilClassBase.getEntityLink(targetEntityType, targetFqn),
        isLink: true,
      });
    }

    if (targetHandle) {
      overviewData.push({
        name: t('label.target-column'),
        value: getNameFromFQN(targetHandle),
      });
    }

    if (pipeline) {
      overviewData.push({
        name: t('label.edge'),
        value: getEntityName(pipeline),
        url: entityUtilClassBase.getEntityLink(
          pipelineEntityType,
          pipeline.fullyQualifiedName
        ),
        isLink: true,
      });
    }

    setEdgeData(overviewData);
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
      {visible && (
        <div className="edge-info-drawer-container">
          <div className="d-flex items-center justify-between">
            <div className="title-section drawer-title-section">
              <div className="title-container">
                <Tooltip
                  mouseEnterDelay={0.5}
                  placement="bottomLeft"
                  title={t('label.edge-information')}
                  trigger="hover">
                  <div className="d-flex items-center gap-2">
                    <span className="d-flex">
                      <GitMerge height={16} width={16} />
                    </span>
                    <Typography.Text
                      className="edge-info-drawer-title"
                      data-testid="edge-header-title">
                      {t('label.edge-information')}
                    </Typography.Text>
                  </div>
                </Tooltip>
              </div>
            </div>
            <Button
              aria-label={t('label.close')}
              className="drawer-close-icon flex-center mr-2"
              data-testid="drawer-close-icon"
              icon={<CloseOutlined />}
              size="small"
              onClick={onClose}
            />
          </div>
          <div className="edge-info-drawer-content">
            {isLoading ? (
              <Loader />
            ) : (
              <div className="d-flex flex-col">
                <div className="summary-panel-card">
                  <DescriptionSection
                    description={edgeEntity?.description ?? ''}
                    entityFqn={edgeEntity.fromEntity.fullyQualifiedName}
                    entityType={EntityType.LINEAGE_EDGE}
                    hasPermission={hasEditAccess}
                    showEditButton={hasEditAccess}
                    onDescriptionUpdate={onDescriptionUpdate}
                  />
                </div>
                {edgeData && edgeData.length > 0 && (
                  <div className="summary-panel-card">
                    <OverviewSection
                      componentType=""
                      entityInfoV1={edgeData}
                      showEditButton={false}
                    />
                  </div>
                )}

                {edgeDetailsSection}
              </div>
            )}
          </div>
        </div>
      )}
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
