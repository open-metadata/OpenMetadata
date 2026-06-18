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
import { isEmpty, isEqual, isUndefined } from 'lodash';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { EntityField } from '../constants/Feeds.constants';
import { TASK_SANITIZE_VALUE_REGEX } from '../constants/regex.constants';
import { EntityType, FqnPart } from '../enums/entity.enum';
import type { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import type { Chart } from '../generated/entity/data/chart';
import type { Container } from '../generated/entity/data/container';
import type { Dashboard } from '../generated/entity/data/dashboard';
import type { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import type { Glossary } from '../generated/entity/data/glossary';
import type { MlFeature, Mlmodel } from '../generated/entity/data/mlmodel';
import type {
  Pipeline,
  Task as PipelineTask,
} from '../generated/entity/data/pipeline';
import type { SearchIndex } from '../generated/entity/data/searchIndex';
import type { Column, Table } from '../generated/entity/data/table';
import type { Field, Topic } from '../generated/entity/data/topic';
import type { EntityReference } from '../generated/entity/type';
import type { TagLabel } from '../generated/type/tagLabel';
import type { EntityData, Option } from '../pages/TasksPage/TasksPage.interface';
import { getEntityName } from './EntityNameUtils';
import { ENTITY_LINK_SEPARATOR } from './EntityPureUtils';
import { getPartialNameFromTableFQN } from './FqnUtils';

export const getEntityColumnsDetails = (
  entityType: string,
  entityData: EntityData
) => {
  switch (entityType) {
    case EntityType.TOPIC:
      return (entityData as Topic).messageSchema?.schemaFields ?? [];

    case EntityType.DASHBOARD:
      return (entityData as Dashboard).charts ?? [];

    case EntityType.PIPELINE:
      return (entityData as Pipeline).tasks ?? [];

    case EntityType.MLMODEL:
      return (entityData as Mlmodel).mlFeatures ?? [];

    case EntityType.CONTAINER:
      return (entityData as Container).dataModel?.columns ?? [];

    case EntityType.API_ENDPOINT: {
      const entityDetails = entityData as APIEndpoint;
      const requestSchemaFields =
        entityDetails.requestSchema?.schemaFields ?? [];
      const responseSchemaFields =
        entityDetails.responseSchema?.schemaFields ?? [];

      return [...requestSchemaFields, ...responseSchemaFields];
    }

    default:
      return (entityData as Table).columns ?? [];
  }
};

type EntityColumns = Column[] | PipelineTask[] | MlFeature[] | Field[];

interface EntityColumnProps {
  description: string;
  tags: TagLabel[];
}

export const getColumnObject = (
  columnName: string,
  columns: EntityColumns,
  entityType: EntityType,
  chartData?: Chart[]
): EntityColumnProps => {
  let columnObject: EntityColumnProps = {} as EntityColumnProps;

  for (let index = 0; index < columns.length; index++) {
    const column = columns[index];
    if (isEqual(column.name, columnName)) {
      columnObject = {
        description: column.description ?? '',
        tags:
          column.tags ??
          (entityType === EntityType.DASHBOARD
            ? chartData?.find((item) => item.name === columnName)?.tags ?? []
            : []),
      };

      break;
    } else {
      columnObject = getColumnObject(
        columnName,
        (column as Column).children || [],
        entityType,
        chartData
      );
    }
  }

  return columnObject;
};

export const getColumnObjectByPath = (
  pathSegments: string[],
  columns: EntityColumns,
  entityType: EntityType,
  chartData?: Chart[]
): EntityColumnProps => {
  const [currentSegment, ...remainingSegments] = pathSegments;
  const matchedColumn = columns.find(
    (column) => column.name === currentSegment
  );

  if (!matchedColumn) {
    return {} as EntityColumnProps;
  }

  if (remainingSegments.length === 0) {
    return {
      description: matchedColumn.description ?? '',
      tags:
        matchedColumn.tags ??
        (entityType === EntityType.DASHBOARD
          ? chartData?.find((item) => item.name === currentSegment)?.tags ?? []
          : []),
    };
  }

  return getColumnObjectByPath(
    remainingSegments,
    (matchedColumn as Column).children || [],
    entityType,
    chartData
  );
};

const TASK_FIELD_CONTAINER_MAP: Record<string, string> = {
  'messageSchema.schemaFields': 'messageSchema',
  'dataModel.columns': 'dataModel',
  'requestSchema.schemaFields': 'requestSchema',
  'responseSchema.schemaFields': 'responseSchema',
};

export const getNormalizedTaskFieldContainer = (field?: string | null) => {
  if (!field) {
    return undefined;
  }

  return TASK_FIELD_CONTAINER_MAP[field] ?? field;
};

export const getTaskFieldColumns = (
  entityType: EntityType,
  entityData: EntityData,
  field?: string | null
) => {
  switch (field) {
    case 'messageSchema.schemaFields':
      return (entityData as Topic).messageSchema?.schemaFields ?? [];
    case 'dataModel.columns':
      return (entityData as Container).dataModel?.columns ?? [];
    case 'requestSchema.schemaFields':
      return (entityData as APIEndpoint).requestSchema?.schemaFields ?? [];
    case 'responseSchema.schemaFields':
      return (entityData as APIEndpoint).responseSchema?.schemaFields ?? [];
    default:
      return getEntityColumnsDetails(entityType, entityData);
  }
};

export const getFormattedTaskFieldValue = (value?: string | null) => {
  if (!value) {
    return undefined;
  }

  if (!value.includes('.') || /^".*"$/.test(value)) {
    return value;
  }

  return `"${value}"`;
};

export const getDescriptionTaskFieldPath = (
  field?: string | null,
  value?: string | null
) => {
  const container = getNormalizedTaskFieldContainer(field);
  const formattedValue = getFormattedTaskFieldValue(value);

  if (!container || !formattedValue) {
    return EntityField.DESCRIPTION;
  }

  return `${container}${ENTITY_LINK_SEPARATOR}${formattedValue}${ENTITY_LINK_SEPARATOR}description`;
};

export const getTagTaskFieldPath = (
  field?: string | null,
  value?: string | null
) => {
  const container = getNormalizedTaskFieldContainer(field);
  const formattedValue = getFormattedTaskFieldValue(value);

  if (!container || !formattedValue) {
    return undefined;
  }

  return `${container}.${formattedValue}`;
};

export const getEntityTaskDetails = (
  entityType: EntityType
): {
  fqnPart: FqnPart[];
  entityField: string;
} => {
  let fqnPartTypes: FqnPart;
  let entityField: string;
  switch (entityType) {
    case EntityType.TABLE:
      fqnPartTypes = FqnPart.NestedColumn;
      entityField = EntityField.COLUMNS;

      break;

    case EntityType.TOPIC:
      fqnPartTypes = FqnPart.Topic;
      entityField = EntityField.MESSAGE_SCHEMA;

      break;

    case EntityType.DASHBOARD:
      fqnPartTypes = FqnPart.Database;
      entityField = EntityField.CHARTS;

      break;

    case EntityType.PIPELINE:
      fqnPartTypes = FqnPart.Schema;
      entityField = EntityField.TASKS;

      break;

    case EntityType.MLMODEL:
      fqnPartTypes = FqnPart.Schema;
      entityField = EntityField.ML_FEATURES;

      break;

    case EntityType.CONTAINER:
      fqnPartTypes = FqnPart.Topic;
      entityField = EntityField.DATA_MODEL;

      break;

    case EntityType.SEARCH_INDEX:
      fqnPartTypes = FqnPart.Topic;
      entityField = EntityField.FIELDS;

      break;
    case EntityType.API_COLLECTION:
      fqnPartTypes = FqnPart.Database;
      entityField = '';

      break;
    case EntityType.API_ENDPOINT:
      fqnPartTypes = FqnPart.ApiEndpoint;
      entityField = 'requestSchema';

      break;

    default:
      fqnPartTypes = FqnPart.Table;
      entityField = EntityField.COLUMNS;
  }

  return { fqnPart: [fqnPartTypes], entityField };
};

export const getEntityTableName = (
  entityType: EntityType,
  name: string,
  entityData: EntityData
): string => {
  if (name.includes('.')) {
    return name;
  }
  let entityReference;

  switch (entityType) {
    case EntityType.TABLE:
      entityReference = (entityData as Table).columns?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.TOPIC:
      entityReference = (entityData as Topic).messageSchema?.schemaFields?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.DASHBOARD:
      entityReference = (entityData as Dashboard).charts?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.PIPELINE:
      entityReference = (entityData as Pipeline).tasks?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.MLMODEL:
      entityReference = (entityData as Mlmodel).mlFeatures?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.CONTAINER:
      entityReference = (entityData as Container).dataModel?.columns?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.SEARCH_INDEX:
      entityReference = (entityData as SearchIndex).fields?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.DASHBOARD_DATA_MODEL:
      entityReference = (entityData as DashboardDataModel).columns?.find(
        (item) => item.name === name
      );

      break;

    default:
      return name;
  }

  if (isUndefined(entityReference)) {
    return name;
  }

  return getEntityName(entityReference);
};

export const getTaskMessage = ({
  value,
  entityType,
  entityData,
  field,
  startMessage,
}: {
  value: string | null;
  entityType: EntityType;
  entityData: EntityData;
  field: string | null;
  startMessage: string;
}) => {
  const sanitizeValue = value?.replaceAll(TASK_SANITIZE_VALUE_REGEX, '') ?? '';

  const entityColumnsName = field
    ? `${field}/${getEntityTableName(entityType, sanitizeValue, entityData)}`
    : '';

  return `${startMessage} for ${entityType} ${getEntityName(
    entityData
  )} ${entityColumnsName}`;
};

export const getTaskAssignee = (entityData: Glossary): Option[] => {
  const { owners, reviewers } = entityData;
  let assignee: EntityReference[] = [];

  if (!isEmpty(reviewers)) {
    assignee = reviewers as EntityReference[];
  } else if (!isEmpty(owners)) {
    assignee = owners ?? [];
  }

  let defaultAssignee: Option[] = [];
  if (!isUndefined(assignee)) {
    defaultAssignee = assignee.map((item) => ({
      label: getEntityName(item),
      value: item.id || '',
      type: item.type,
      name: item.name,
    }));
  }

  return defaultAssignee;
};

export const getTaskEntityFQN = (entityType: EntityType, fqn: string) => {
  if (entityType === EntityType.TABLE) {
    return getPartialNameFromTableFQN(
      fqn,
      [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
      FQN_SEPARATOR_CHAR
    );
  }

  return fqn;
};
