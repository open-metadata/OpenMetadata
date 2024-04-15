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
import { Button, Col, Divider, Drawer, Row, Typography } from 'antd';
import { isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Node } from 'reactflow';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import DescriptionV1 from '../../../components/common/EntityDescription/DescriptionV1';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { LINEAGE_SOURCE } from '../../../constants/Lineage.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import { Source } from '../../../generated/type/entityLineage';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import { getLineageDetailsObject } from '../../../utils/EntityLineageUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import Loader from '../../common/Loader/Loader';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
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
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);
  const [showSqlQueryModal, setShowSqlQueryModal] = useState(false);

  const { t } = useTranslation();

  const edgeEntity = useMemo(() => {
    return edge.data.edge;
  }, [edge]);

  const getEdgeInfo = () => {
    const { source, target, data, sourceHandle, targetHandle } = edge;
    let sourceData: Node | undefined, targetData: Node | undefined;
    nodes.forEach((node) => {
      if (source === node.id) {
        sourceData = node;
      } else if (target === node.id) {
        targetData = node;
      }
    });

    setEdgeData({
      sourceData: {
        key: t('label.source'),
        value: sourceData && getEntityName(sourceData?.data?.node),
        link:
          sourceData &&
          entityUtilClassBase.getEntityLink(
            data.sourceType,
            sourceData.data.node.fullyQualifiedName
          ),
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
          entityUtilClassBase.getEntityLink(
            data.targetData,
            targetData.data.node.fullyQualifiedName
          ),
      },
      targetColumn: {
        key: t('label.target-column'),
        value: targetHandle ? getNameFromFQN(targetHandle) : undefined,
      },
      pipeline: {
        key: t('label.edge'),
        value: data?.edge?.pipeline
          ? getEntityName(data?.edge?.pipeline)
          : undefined,
        link:
          data?.edge?.pipeline &&
          entityUtilClassBase.getEntityLink(
            data?.edge?.pipeline.type,
            data?.edge?.pipeline.fullyQualifiedName
          ),
      },
      functionInfo: {
        key: t('label.function'),
        value: data.columnFunctionValue,
      },
    });
    setIsLoading(false);
  };

  const edgeDescription = useMemo(() => {
    return edgeEntity?.description ?? '';
  }, [edgeEntity]);

  const onDescriptionUpdate = useCallback(
    async (updatedHTML: string) => {
      if (edgeDescription !== updatedHTML && edge) {
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
        };
        await onEdgeDetailsUpdate?.(updatedEdgeDetails);
      }
      setIsDescriptionEditable(false);
    },
    [edgeDescription, edgeEntity, edge]
  );

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
        };
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
          <Row gutter={[8, 8]}>
            {edgeData &&
              Object.values(edgeData).map(
                (data) =>
                  data.value && (
                    <Col data-testid={data.key} key={data.key} span={24}>
                      <Typography.Text className="m-r-sm summary-panel-section-title">
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
            <Col span={24}>
              <Divider />
              <DescriptionV1
                description={edgeDescription}
                entityName="Edge"
                entityType={EntityType.GLOSSARY}
                hasEditAccess={hasEditAccess}
                isEdit={isDescriptionEditable}
                showCommentsIcon={false}
                onCancel={() => setIsDescriptionEditable(false)}
                onDescriptionEdit={() => setIsDescriptionEditable(true)}
                onDescriptionUpdate={onDescriptionUpdate}
              />
            </Col>
            <Col span={24}>
              <Divider />
              <div className="d-flex items-center gap-4 m-b-sm">
                <Typography.Paragraph className="right-panel-label m-b-0">
                  {`${t('label.sql-uppercase-query')}`}
                </Typography.Paragraph>
                {hasEditAccess && (
                  <Button
                    className="p-0 flex-center"
                    data-testid="edit-sql"
                    icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                    size="small"
                    type="text"
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
            <Col>
              <Divider />
              <Typography.Paragraph className="right-panel-label m-b-sm">
                {`${t('label.lineage-source')}`}
              </Typography.Paragraph>
              <Typography.Text className="m-b-0">
                {LINEAGE_SOURCE[edgeEntity.source as keyof typeof Source]}
              </Typography.Text>
            </Col>
          </Row>
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
    </>
  );
};

export default EdgeInfoDrawer;
