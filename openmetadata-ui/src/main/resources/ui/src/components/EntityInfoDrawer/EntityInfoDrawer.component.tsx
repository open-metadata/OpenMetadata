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
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import DashboardSummary from 'components/Explore/EntitySummaryPanel/DashboardSummary/DashboardSummary.component';
import MlModelSummary from 'components/Explore/EntitySummaryPanel/MlModelSummary/MlModelSummary.component';
import PipelineSummary from 'components/Explore/EntitySummaryPanel/PipelineSummary/PipelineSummary.component';
import TableSummary from 'components/Explore/EntitySummaryPanel/TableSummary/TableSummary.component';
import TopicSummary from 'components/Explore/EntitySummaryPanel/TopicSummary/TopicSummary.component';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { Mlmodel } from 'generated/entity/data/mlmodel';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDashboardByFqn } from 'rest/dashboardAPI';
import { getMlModelByFQN } from 'rest/mlModelAPI';
import { getPipelineByFqn } from 'rest/pipelineAPI';
import { getTableDetailsByFQN } from 'rest/tableAPI';
import { getTopicByFqn } from 'rest/topicsAPI';
import { EntityType } from '../../enums/entity.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { Table } from '../../generated/entity/data/table';
import { Topic } from '../../generated/entity/data/topic';
import { getHeaderLabel } from '../../utils/EntityLineageUtils';
import { DRAWER, getEntityTags } from '../../utils/EntityUtils';
import { getEncodedFqn } from '../../utils/StringsUtils';
import { getEntityIcon } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { SelectedNode } from '../EntityLineage/EntityLineage.interface';
import Loader from '../Loader/Loader';
import { LineageDrawerProps } from './EntityInfoDrawer.interface';
import './EntityInfoDrawer.style.less';

type EntityData = Table | Pipeline | Dashboard | Topic | Mlmodel;

const EntityInfoDrawer = ({
  show,
  onCancel,
  selectedNode,
  isMainNode = false,
}: LineageDrawerProps) => {
  const { t } = useTranslation();
  const [entityDetail, setEntityDetail] = useState<EntityData>(
    {} as EntityData
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchEntityDetail = (selectedNode: SelectedNode) => {
    switch (selectedNode.type) {
      case EntityType.TABLE: {
        setIsLoading(true);
        getTableDetailsByFQN(getEncodedFqn(selectedNode.fqn), [
          'tags',
          'owner',
          'columns',
          'usageSummary',
          'profile',
        ])
          .then((res) => {
            setEntityDetail(res);
          })
          .catch(() => {
            showErrorToast(
              t('server.error-selected-node-name-details', {
                selectedNodeName: selectedNode.name,
              })
            );
          })
          .finally(() => {
            setIsLoading(false);
          });

        break;
      }
      case EntityType.PIPELINE: {
        setIsLoading(true);
        getPipelineByFqn(getEncodedFqn(selectedNode.fqn), ['tags', 'owner'])
          .then((res) => {
            setEntityDetail(res);
            setIsLoading(false);
          })
          .catch(() => {
            showErrorToast(
              t('server.error-selected-node-name-details', {
                selectedNodeName: selectedNode.name,
              })
            );
          })
          .finally(() => {
            setIsLoading(false);
          });

        break;
      }

      case EntityType.TOPIC: {
        setIsLoading(true);
        getTopicByFqn(selectedNode.fqn ?? '', '')
          .then((res) => {
            setEntityDetail(res);
          })
          .catch(() => {
            showErrorToast(
              t('server.entity-details-fetch-error', {
                entityType: t('label.topic-lowercase'),
                entityName: selectedNode.name,
              })
            );
          })
          .finally(() => {
            setIsLoading(false);
          });

        break;
      }
      case EntityType.DASHBOARD: {
        setIsLoading(true);
        getDashboardByFqn(getEncodedFqn(selectedNode.fqn), [
          'tags',
          'owner',
          'charts',
        ])
          .then((res) => {
            setEntityDetail(res);
            setIsLoading(false);
          })
          .catch(() => {
            showErrorToast(
              t('server.error-selected-node-name-details', {
                selectedNodeName: selectedNode.name,
              })
            );
          })
          .finally(() => {
            setIsLoading(false);
          });

        break;
      }

      case EntityType.MLMODEL: {
        setIsLoading(true);
        getMlModelByFQN(getEncodedFqn(selectedNode.fqn), [
          'tags',
          'owner',
          'dashboard',
        ])
          .then((res) => {
            setEntityDetail(res);
            setIsLoading(false);
          })
          .catch(() => {
            showErrorToast(
              t('server.error-selected-node-name-details', {
                selectedNodeName: selectedNode.name,
              })
            );
          })
          .finally(() => {
            setIsLoading(false);
          });

        break;
      }
      default:
        break;
    }
  };

  const tags = useMemo(
    () => getEntityTags(selectedNode.type, entityDetail),
    [entityDetail, selectedNode]
  );

  const summaryComponent = useMemo(() => {
    switch (selectedNode.type) {
      case EntityType.TABLE:
        return (
          <TableSummary
            componentType={DRAWER.lineage}
            entityDetails={entityDetail as Table}
          />
        );

      case EntityType.TOPIC:
        return (
          <TopicSummary
            componentType={DRAWER.lineage}
            entityDetails={entityDetail as Topic}
          />
        );

      case EntityType.DASHBOARD:
        return (
          <DashboardSummary
            componentType={DRAWER.lineage}
            entityDetails={entityDetail as Dashboard}
          />
        );

      case EntityType.PIPELINE:
        return (
          <PipelineSummary
            componentType={DRAWER.lineage}
            entityDetails={entityDetail as Pipeline}
          />
        );

      case EntityType.MLMODEL:
        return (
          <MlModelSummary
            componentType={DRAWER.lineage}
            entityDetails={entityDetail as Mlmodel}
          />
        );

      default:
        return null;
    }
  }, [entityDetail, fetchEntityDetail, setEntityDetail]);

  useEffect(() => {
    fetchEntityDetail(selectedNode);
  }, [selectedNode]);

  return (
    <Drawer
      destroyOnClose
      bodyStyle={{ padding: 16 }}
      className="summary-panel-container"
      closable={false}
      extra={<CloseOutlined onClick={onCancel} />}
      getContainer={false}
      headerStyle={{ padding: 16 }}
      mask={false}
      open={show}
      style={{ position: 'absolute' }}
      title={
        <>
          <Row gutter={16}>
            <Col span={24}>
              {'databaseSchema' in entityDetail &&
                'database' in entityDetail && (
                  <span
                    className="text-grey-muted text-xs"
                    data-testid="database-schema">{`${entityDetail.database?.name}${FQN_SEPARATOR_CHAR}${entityDetail.databaseSchema?.name}`}</span>
                )}
            </Col>
            <Col span={24}>
              <p className="tw-flex">
                <span className="tw-mr-2">
                  {getEntityIcon(selectedNode.type)}
                </span>
                {getHeaderLabel(
                  selectedNode.displayName ?? selectedNode.name,
                  selectedNode.fqn,
                  selectedNode.type,
                  isMainNode
                )}
              </p>
            </Col>
          </Row>
        </>
      }>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          {summaryComponent}

          <Row gutter={[0, 16]}>
            <Col span={24}>
              <span className="text-grey-muted">{t('label.tag-plural')}</span>
            </Col>
            <Col span={24}>
              <div className="flex flex-wrap">
                {tags.length > 0 ? (
                  <TagsViewer sizeCap={-1} tags={tags} />
                ) : (
                  <p className="text-xs text-grey-muted">
                    {t('label.no-tags-added')}
                  </p>
                )}
              </div>
            </Col>
          </Row>

          <Divider className="m-y-xs" />

          <Row gutter={[0, 16]}>
            <Col span={24}>
              <Typography.Text
                className="tw-text-grey-muted"
                data-testid="schema-header">
                {t('label.description')}
              </Typography.Text>
            </Col>
            <Col span={24}>
              <div>
                {entityDetail.description?.trim() ? (
                  <RichTextEditorPreviewer
                    markdown={entityDetail.description}
                  />
                ) : (
                  <p className="text-xs text-grey-muted">
                    {t('label.no-data-found')}
                  </p>
                )}
              </div>
            </Col>
          </Row>
        </>
      )}
    </Drawer>
  );
};

export default EntityInfoDrawer;
