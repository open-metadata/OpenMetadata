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
import { Col, Divider, Drawer, Row, Typography } from 'antd';
import { isUndefined } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Node } from 'reactflow';
import { CSMode } from '../../enums/codemirror.enum';
import { getEntityName, getNameFromFQN } from '../../utils/CommonUtils';
import { getEntityLink } from '../../utils/TableUtils';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import Loader from '../Loader/Loader';
import SchemaEditor from '../schema-editor/SchemaEditor';
import {
  EdgeInfoDrawerInfo,
  EdgeInformationType,
} from './EntityInfoDrawer.interface';

import './EntityInfoDrawer.style.less';

const EdgeInfoDrawer = ({
  edge,
  visible,
  onClose,
  nodes,
}: EdgeInfoDrawerInfo) => {
  const [edgeData, setEdgeData] = useState<EdgeInformationType>();
  const [mysqlQuery, setMysqlQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

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
          getEntityLink(
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
          getEntityLink(
            data.targetData,
            targetData.data.node.fullyQualifiedName
          ),
      },
      targetColumn: {
        key: t('label.target-column'),
        value: targetHandle ? getNameFromFQN(targetHandle) : undefined,
      },
      pipeline: {
        key: t('label.pipeline'),
        value: data?.pipeline ? getEntityName(data?.pipeline) : undefined,
        link:
          data?.pipeline &&
          getEntityLink(data?.pipeline.type, data?.pipeline.fullyQualifiedName),
      },
      functionInfo: {
        key: t('label.function'),
        value: data.columnFunctionValue,
      },
    });
    setIsLoading(false);
  };

  useEffect(() => {
    setIsLoading(true);
    getEdgeInfo();
    setMysqlQuery(edge.data.edge?.lineageDetails?.sqlQuery);
  }, [edge, visible]);

  return (
    <Drawer
      destroyOnClose
      bodyStyle={{ padding: 16 }}
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
                  <Col key={data.key} span={24}>
                    <Typography.Text className="m-r-sm">
                      {data.key}:
                    </Typography.Text>

                    {isUndefined(data.link) ? (
                      <Typography.Text>{data.value}</Typography.Text>
                    ) : (
                      <Typography.Link>
                        <Link to={data.link}>{data.value}</Link>
                      </Typography.Link>
                    )}
                  </Col>
                )
            )}
          <Col span={24}>
            <Divider />
            <Typography.Paragraph>
              {t('label.description')}:
            </Typography.Paragraph>
            {edge?.data.edge?.description?.trim() ? (
              <RichTextEditorPreviewer
                markdown={edge?.data.edge?.description}
              />
            ) : (
              <Typography.Paragraph className="text-grey-muted m-b-0">
                {t('label.no-entity', {
                  entity: t('label.description'),
                })}
              </Typography.Paragraph>
            )}
          </Col>
          <Col span={24}>
            <Divider />
            <Typography.Paragraph>{t('label.sql-query')}:</Typography.Paragraph>
            {mysqlQuery ? (
              <SchemaEditor
                className="edge-drawer-sql-editor"
                mode={{ name: CSMode.SQL }}
                value={mysqlQuery}
              />
            ) : (
              <Typography.Paragraph className="text-grey-muted m-b-0">
                {t('server.no-query-available')}
              </Typography.Paragraph>
            )}
          </Col>
        </Row>
      )}
    </Drawer>
  );
};

export default EdgeInfoDrawer;
