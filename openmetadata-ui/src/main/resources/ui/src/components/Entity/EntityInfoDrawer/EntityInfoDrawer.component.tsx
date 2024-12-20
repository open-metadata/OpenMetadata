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
import { Col, Drawer, Row } from 'antd';
import { cloneDeep, get } from 'lodash';
import { EntityDetailUnion } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { APIEndpoint } from '../../../generated/entity/data/apiEndpoint';
import { Container } from '../../../generated/entity/data/container';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { DashboardDataModel } from '../../../generated/entity/data/dashboardDataModel';
import { Metric } from '../../../generated/entity/data/metric';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { SearchIndex } from '../../../generated/entity/data/searchIndex';
import { StoredProcedure } from '../../../generated/entity/data/storedProcedure';
import { Table } from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';
import { TagLabel } from '../../../generated/type/tagLabel';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityTags,
} from '../../../utils/EntityUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import APIEndpointSummary from '../../Explore/EntitySummaryPanel/APIEndpointSummary/APIEndpointSummary';
import ContainerSummary from '../../Explore/EntitySummaryPanel/ContainerSummary/ContainerSummary.component';
import DashboardSummary from '../../Explore/EntitySummaryPanel/DashboardSummary/DashboardSummary.component';
import DataModelSummary from '../../Explore/EntitySummaryPanel/DataModelSummary/DataModelSummary.component';
import MetricSummary from '../../Explore/EntitySummaryPanel/MetricSummary/MetricSummary';
import MlModelSummary from '../../Explore/EntitySummaryPanel/MlModelSummary/MlModelSummary.component';
import PipelineSummary from '../../Explore/EntitySummaryPanel/PipelineSummary/PipelineSummary.component';
import SearchIndexSummary from '../../Explore/EntitySummaryPanel/SearchIndexSummary/SearchIndexSummary.component';
import StoredProcedureSummary from '../../Explore/EntitySummaryPanel/StoredProcedureSummary/StoredProcedureSummary.component';
import TableSummary from '../../Explore/EntitySummaryPanel/TableSummary/TableSummary.component';
import TopicSummary from '../../Explore/EntitySummaryPanel/TopicSummary/TopicSummary.component';
import EntityHeaderTitle from '../EntityHeaderTitle/EntityHeaderTitle.component';
import './entity-info-drawer.less';
import { LineageDrawerProps } from './EntityInfoDrawer.interface';

const EntityInfoDrawer = ({
  show,
  onCancel,
  selectedNode,
}: LineageDrawerProps) => {
  const [entityDetail, setEntityDetail] = useState<EntityDetailUnion>(
    {} as EntityDetailUnion
  );

  const breadcrumbs = useMemo(
    () =>
      searchClassBase.getEntityBreadcrumbs(
        selectedNode,
        selectedNode.entityType as EntityType,
        true
      ),
    [selectedNode]
  );

  const icon = useMemo(() => {
    const serviceType = get(selectedNode, 'serviceType', '');

    return serviceType ? (
      <img
        className="h-9"
        src={serviceUtilClassBase.getServiceTypeLogo(selectedNode)}
      />
    ) : null;
  }, [selectedNode]);

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

      case EntityType.API_ENDPOINT:
        return (
          <APIEndpointSummary
            componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
            entityDetails={entityDetail as APIEndpoint}
          />
        );

      case EntityType.METRIC:
        return (
          <MetricSummary
            componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
            entityDetails={entityDetail as Metric}
          />
        );

      default:
        return null;
    }
  }, [entityDetail, tags, selectedNode]);

  useEffect(() => {
    const node = cloneDeep(selectedNode);
    // Since selectedNode is a source object, modify the tags to contain tier information
    node.tags = [
      ...(node.tags ?? []),
      ...(node.tier ? [node.tier as TagLabel] : []),
    ];

    setEntityDetail(node);
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
        <Row gutter={[0, 0]}>
          {selectedNode.entityType === EntityType.TABLE && (
            <Col span={24}>
              <TitleBreadcrumb titleLinks={breadcrumbs} />
            </Col>
          )}

          <Col span={24}>
            <EntityHeaderTitle
              className="w-max-350"
              deleted={selectedNode.deleted}
              displayName={selectedNode.displayName}
              icon={icon}
              link={entityUtilClassBase.getEntityLink(
                selectedNode.entityType ?? '',
                selectedNode.fullyQualifiedName ?? ''
              )}
              name={selectedNode.name}
              serviceName={selectedNode.service?.type ?? ''}
              showName={false}
            />
          </Col>
        </Row>
      }>
      <div className="m-t-md">{summaryComponent}</div>
    </Drawer>
  );
};

export default EntityInfoDrawer;
