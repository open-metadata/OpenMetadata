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
import classNames from 'classnames';
import { EntityDetailUnion } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Container } from '../../../generated/entity/data/container';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { DashboardDataModel } from '../../../generated/entity/data/dashboardDataModel';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { SearchIndex } from '../../../generated/entity/data/searchIndex';
import { StoredProcedure } from '../../../generated/entity/data/storedProcedure';
import { Table } from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';
import { getHeaderLabel } from '../../../utils/EntityLineageUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityTags,
} from '../../../utils/EntityUtils';
import { getEntityIcon } from '../../../utils/TableUtils';
import ContainerSummary from '../../Explore/EntitySummaryPanel/ContainerSummary/ContainerSummary.component';
import DashboardSummary from '../../Explore/EntitySummaryPanel/DashboardSummary/DashboardSummary.component';
import DataModelSummary from '../../Explore/EntitySummaryPanel/DataModelSummary/DataModelSummary.component';
import MlModelSummary from '../../Explore/EntitySummaryPanel/MlModelSummary/MlModelSummary.component';
import PipelineSummary from '../../Explore/EntitySummaryPanel/PipelineSummary/PipelineSummary.component';
import SearchIndexSummary from '../../Explore/EntitySummaryPanel/SearchIndexSummary/SearchIndexSummary.component';
import StoredProcedureSummary from '../../Explore/EntitySummaryPanel/StoredProcedureSummary/StoredProcedureSummary.component';
import TableSummary from '../../Explore/EntitySummaryPanel/TableSummary/TableSummary.component';
import TopicSummary from '../../Explore/EntitySummaryPanel/TopicSummary/TopicSummary.component';
import './entity-info-drawer.less';
import { LineageDrawerProps } from './EntityInfoDrawer.interface';

const EntityInfoDrawer = ({
  show,
  onCancel,
  selectedNode,
  isMainNode = false,
}: LineageDrawerProps) => {
  const [entityDetail, setEntityDetail] = useState<EntityDetailUnion>(
    {} as EntityDetailUnion
  );

  const tags = useMemo(
    () =>
      getEntityTags(selectedNode.entityType ?? EntityType.TABLE, entityDetail),
    [entityDetail, selectedNode]
  );

  const summaryComponent = useMemo(() => {
    switch (selectedNode.entityType) {
      case EntityType.TABLE:
        return (
          <TableSummary
            componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
            entityDetails={entityDetail as Table}
            tags={tags}
          />
        );

      case EntityType.TOPIC:
        return (
          <TopicSummary
            componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
            entityDetails={entityDetail as Topic}
            tags={tags}
          />
        );

      case EntityType.DASHBOARD:
        return (
          <DashboardSummary
            componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
            entityDetails={entityDetail as Dashboard}
            tags={tags}
          />
        );

      case EntityType.PIPELINE:
        return (
          <PipelineSummary
            componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
            entityDetails={entityDetail as Pipeline}
            tags={tags}
          />
        );

      case EntityType.MLMODEL:
        return (
          <MlModelSummary
            componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
            entityDetails={entityDetail as Mlmodel}
            tags={tags}
          />
        );
      case EntityType.CONTAINER:
        return (
          <ContainerSummary
            componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
            entityDetails={entityDetail as Container}
            tags={tags}
          />
        );

      case EntityType.DASHBOARD_DATA_MODEL:
        return (
          <DataModelSummary
            componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
            entityDetails={entityDetail as DashboardDataModel}
            tags={tags}
          />
        );

      case EntityType.STORED_PROCEDURE:
        return (
          <StoredProcedureSummary
            componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
            entityDetails={entityDetail as StoredProcedure}
            tags={tags}
          />
        );

      case EntityType.SEARCH_INDEX:
        return (
          <SearchIndexSummary
            componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
            entityDetails={entityDetail as SearchIndex}
            tags={tags}
          />
        );

      default:
        return null;
    }
  }, [entityDetail, tags, selectedNode]);

  useEffect(() => {
    setEntityDetail(selectedNode);
  }, [selectedNode]);

  return (
    <Drawer
      destroyOnClose
      className="entity-panel-container"
      closable={false}
      extra={
        <CloseOutlined
          data-testid="entity-panel-close-icon"
          onClick={onCancel}
        />
      }
      getContainer={false}
      headerStyle={{ padding: 16 }}
      mask={false}
      open={show}
      style={{ position: 'absolute' }}
      title={
        <Row gutter={[0, isMainNode ? 6 : 0]}>
          <Col span={24}>
            {'databaseSchema' in entityDetail && 'database' in entityDetail && (
              <span
                className="text-grey-muted text-xs"
                data-testid="database-schema">{`${entityDetail.database?.name}${FQN_SEPARATOR_CHAR}${entityDetail.databaseSchema?.name}`}</span>
            )}
          </Col>
          <Col span={24}>
            <Typography
              className={classNames('flex items-center text-base', {
                'entity-info-header-link': !isMainNode,
              })}>
              <span className="m-r-xs w-4">
                {getEntityIcon(selectedNode.entityType as string)}
              </span>
              {getHeaderLabel(
                selectedNode.displayName ?? selectedNode.name,
                selectedNode.fullyQualifiedName,
                selectedNode.entityType as string,
                isMainNode
              )}
            </Typography>
          </Col>
        </Row>
      }>
      <div className="m-t-md">{summaryComponent}</div>
    </Drawer>
  );
};

export default EntityInfoDrawer;
