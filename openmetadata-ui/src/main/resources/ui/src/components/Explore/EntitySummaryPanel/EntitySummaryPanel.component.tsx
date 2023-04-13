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
import { Drawer } from 'antd';
import { EntityHeader } from 'components/Entity/EntityHeader/EntityHeader.component';
import { EntityType } from 'enums/entity.enum';
import { Tag } from 'generated/entity/classification/tag';
import { Container } from 'generated/entity/data/container';
import { Dashboard } from 'generated/entity/data/dashboard';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import { Table } from 'generated/entity/data/table';
import { get } from 'lodash';
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getEntityBreadcrumbs } from 'utils/EntityUtils';
import { getServiceIcon } from 'utils/TableUtils';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { Topic } from '../../../generated/entity/data/topic';
import ContainerSummary from './ContainerSummary/ContainerSummary.component';
import DashboardSummary from './DashboardSummary/DashboardSummary.component';
import { EntitySummaryPanelProps } from './EntitySummaryPanel.interface';
import './EntitySummaryPanel.style.less';
import GlossaryTermSummary from './GlossaryTermSummary/GlossaryTermSummary.component';
import MlModelSummary from './MlModelSummary/MlModelSummary.component';
import PipelineSummary from './PipelineSummary/PipelineSummary.component';
import TableSummary from './TableSummary/TableSummary.component';
import TagsSummary from './TagsSummary/TagsSummary.component';
import TopicSummary from './TopicSummary/TopicSummary.component';

export default function EntitySummaryPanel({
  entityDetails,
  handleClosePanel,
}: EntitySummaryPanelProps) {
  const { tab } = useParams<{ tab: string }>();

  const summaryComponent = useMemo(() => {
    const type = get(entityDetails, 'details.entityType') ?? EntityType.TABLE;
    const entity = entityDetails.details;
    switch (type) {
      case EntityType.TABLE:
        return <TableSummary entityDetails={entity as Table} />;

      case EntityType.TOPIC:
        return <TopicSummary entityDetails={entity as Topic} />;

      case EntityType.DASHBOARD:
        return <DashboardSummary entityDetails={entity as Dashboard} />;

      case EntityType.PIPELINE:
        return <PipelineSummary entityDetails={entity as Pipeline} />;

      case EntityType.MLMODEL:
        return <MlModelSummary entityDetails={entity as Mlmodel} />;

      case EntityType.CONTAINER:
        return <ContainerSummary entityDetails={entity as Container} />;

      case EntityType.GLOSSARY:
        return <GlossaryTermSummary entityDetails={entity as GlossaryTerm} />;

      case EntityType.TAG:
        return <TagsSummary entityDetails={entity as Tag} />;

      default:
        return null;
    }
  }, [tab, entityDetails]);

  const icon = useMemo(() => {
    return getServiceIcon(entityDetails.details);
  }, [entityDetails]);

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
        <EntityHeader
          titleIsLink
          breadcrumb={getEntityBreadcrumbs(
            entityDetails.details,
            entityDetails.details.entityType as EntityType
          )}
          entityData={entityDetails.details}
          entityType={entityDetails.details.entityType as EntityType}
          icon={icon}
        />
      }
      width="100%">
      {summaryComponent}
    </Drawer>
  );
}
