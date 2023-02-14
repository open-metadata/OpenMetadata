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
import TableDataCardTitle from 'components/common/table-data-card-v2/TableDataCardTitle.component';
import { EntityType } from 'enums/entity.enum';
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExplorePageTabs } from '../../../enums/Explore.enum';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { Table } from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';
import DashboardSummary from './DashboardSummary/DashboardSummary.component';
import { EntitySummaryPanelProps } from './EntitySummaryPanel.interface';
import './EntitySummaryPanel.style.less';
import MlModelSummary from './MlModelSummary/MlModelSummary.component';
import PipelineSummary from './PipelineSummary/PipelineSummary.component';
import TableSummary from './TableSummary/TableSummary.component';
import TopicSummary from './TopicSummary/TopicSummary.component';

export default function EntitySummaryPanel({
  entityDetails,
  handleClosePanel,
}: EntitySummaryPanelProps) {
  const { tab } = useParams<{ tab: string }>();
  const [currentSearchIndex, setCurrentSearchIndex] = useState<EntityType>();

  const summaryComponent = useMemo(() => {
    switch (entityDetails.entityType) {
      case ExplorePageTabs.TABLES:
        setCurrentSearchIndex(EntityType.TABLE);

        return <TableSummary entityDetails={entityDetails.details as Table} />;

      case ExplorePageTabs.TOPICS:
        setCurrentSearchIndex(EntityType.TOPIC);

        return <TopicSummary entityDetails={entityDetails.details as Topic} />;

      case ExplorePageTabs.DASHBOARDS:
        setCurrentSearchIndex(EntityType.DASHBOARD);

        return (
          <DashboardSummary
            entityDetails={entityDetails.details as Dashboard}
          />
        );

      case ExplorePageTabs.PIPELINES:
        setCurrentSearchIndex(EntityType.PIPELINE);

        return (
          <PipelineSummary entityDetails={entityDetails.details as Pipeline} />
        );

      case ExplorePageTabs.MLMODELS:
        setCurrentSearchIndex(EntityType.MLMODEL);

        return (
          <MlModelSummary entityDetails={entityDetails.details as Mlmodel} />
        );

      default:
        return null;
    }
  }, [tab, entityDetails]);

  return (
    <Drawer
      destroyOnClose
      open
      className="summary-panel-container"
      closable={false}
      extra={
        <CloseOutlined
          data-testid="summary-panel-close-icon"
          onClick={handleClosePanel}
        />
      }
      getContainer={false}
      headerStyle={{ padding: 16 }}
      mask={false}
      title={
        <Row gutter={[0, 6]}>
          <Col span={24}>
            <TableDataCardTitle
              isPanel
              dataTestId="summary-panel-title"
              searchIndex={currentSearchIndex as EntityType}
              source={entityDetails.details}
            />
          </Col>
        </Row>
      }
      width="100%">
      {summaryComponent}
    </Drawer>
  );
}
