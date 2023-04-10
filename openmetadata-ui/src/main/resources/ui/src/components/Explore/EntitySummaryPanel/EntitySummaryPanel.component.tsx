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
import { SearchedDataProps } from 'components/searched-data/SearchedData.interface';
import { EntityType } from 'enums/entity.enum';
import { Tag } from 'generated/entity/classification/tag';
import { Container } from 'generated/entity/data/container';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getEntityBreadcrumbs } from 'utils/EntityUtils';
import { serviceTypeLogo } from 'utils/ServiceUtils';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { Table } from '../../../generated/entity/data/table';
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
    switch (entityDetails.entityType) {
      case EntityType.TABLE:
        return <TableSummary entityDetails={entityDetails as Table} />;

      case EntityType.TOPIC:
        return <TopicSummary entityDetails={entityDetails as Topic} />;

      case EntityType.DASHBOARD:
        return <DashboardSummary entityDetails={entityDetails as Dashboard} />;

      case EntityType.PIPELINE:
        return <PipelineSummary entityDetails={entityDetails as Pipeline} />;

      case EntityType.MLMODEL:
        return <MlModelSummary entityDetails={entityDetails as Mlmodel} />;

      case EntityType.CONTAINER:
        return <ContainerSummary entityDetails={entityDetails as Container} />;
      case EntityType.GLOSSARY:
        return (
          <GlossaryTermSummary entityDetails={entityDetails as GlossaryTerm} />
        );
      case EntityType.TAG:
        return <TagsSummary entityDetails={entityDetails as Tag} />;

      default:
        return null;
    }
  }, [tab, entityDetails]);

  const icon = useMemo(() => {
    if ('serviceType' in entityDetails) {
      console.log(entityDetails.serviceType);
      console.log(entityDetails.serviceType);

      return (
        <img
          className="h-8"
          src={serviceTypeLogo(entityDetails.serviceType ?? '')}
        />
      );
    }

    return null;
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
          breadcrumb={getEntityBreadcrumbs(
            entityDetails as SearchedDataProps['data'][number]['_source'],
            entityDetails.entityType as EntityType
          )}
          entityData={entityDetails}
          icon={icon}
        />
      }
      width="100%">
      {summaryComponent}
    </Drawer>
  );
}
