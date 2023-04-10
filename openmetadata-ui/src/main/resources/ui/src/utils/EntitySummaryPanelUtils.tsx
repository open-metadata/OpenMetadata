/*
 *  Copyright 2023 Collate.
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

import { Space, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React from 'react';
import { Link } from 'react-router-dom';
import { BasicEntityInfo } from '../components/Explore/EntitySummaryPanel/SummaryList/SummaryList.interface';
import { SummaryEntityType } from '../enums/EntitySummary.enum';
import { Chart } from '../generated/entity/data/chart';
import { MlFeature } from '../generated/entity/data/mlmodel';
import { Task } from '../generated/entity/data/pipeline';
import { Column, TableConstraint } from '../generated/entity/data/table';
import { Field } from '../generated/entity/data/topic';
import { getEntityName } from './EntityUtils';
import SVGIcons from './SvgUtils';

const { Text } = Typography;

export const getFormattedEntityData = (
  entityType: SummaryEntityType,
  entityInfo?: Array<Column | Field | Chart | Task | MlFeature>,
  tableConstraints?: TableConstraint[]
): BasicEntityInfo[] => {
  if (isEmpty(entityInfo)) {
    return [];
  }
  switch (entityType) {
    case SummaryEntityType.COLUMN: {
      return (entityInfo as Column[]).map((column) => ({
        name: column.name,
        title: (
          <Text className="entity-title">
            {column.displayName || column.name}
          </Text>
        ),
        type: column.dataType,
        tags: column.tags,
        description: column.description,
        columnConstraint: column.constraint,
        tableConstraints: tableConstraints,
        children: getFormattedEntityData(
          SummaryEntityType.COLUMN,
          column.children
        ),
      }));
    }
    case SummaryEntityType.CHART: {
      return (entityInfo as Chart[]).map((chart) => ({
        name: chart.name,
        title: (
          <Link target="_blank" to={{ pathname: chart.chartUrl }}>
            <Space className="m-b-xs">
              <Text className="entity-title text-primary font-medium">
                {getEntityName(chart)}
              </Text>
              <SVGIcons alt="external-link" icon="external-link" width="12px" />
            </Space>
          </Link>
        ),
        type: chart.chartType,
        tags: chart.tags,
        description: chart.description,
      }));
    }
    case SummaryEntityType.TASK: {
      return (entityInfo as Task[]).map((task) => ({
        name: task.name,
        title: (
          <Link target="_blank" to={{ pathname: task.taskUrl }}>
            <Space className="m-b-xs">
              <Text className="entity-title text-primary font-medium">
                {task.name}
              </Text>
              <SVGIcons alt="external-link" icon="external-link" width="12px" />
            </Space>
          </Link>
        ),
        type: task.taskType,
        tags: task.tags,
        description: task.description,
      }));
    }
    case SummaryEntityType.MLFEATURE: {
      return (entityInfo as MlFeature[]).map((feature) => ({
        algorithm: feature.featureAlgorithm,
        name: feature.name || '--',
        title: <Text className="entity-title">{feature.name}</Text>,
        type: feature.dataType,
        tags: feature.tags,
        description: feature.description,
      }));
    }
    case SummaryEntityType.SCHEMAFIELD: {
      return (entityInfo as Field[]).map((field) => ({
        name: field.name,
        title: <Text className="entity-title">{field.name}</Text>,
        type: field.dataType,
        description: field.description,
        tags: field.tags,
        children: getFormattedEntityData(
          SummaryEntityType.SCHEMAFIELD,
          field.children
        ),
      }));
    }
    default: {
      return [];
    }
  }
};
