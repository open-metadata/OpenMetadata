/*
 *  Copyright 2024 Collate.
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

import { cloneDeep, isUndefined } from 'lodash';
import { EntityTags } from 'Models';
import { EntityType } from '../enums/entity.enum';
import { APIEndpoint, Field } from '../generated/entity/data/apiEndpoint';
import { Container } from '../generated/entity/data/container';
import {
  Column as DataModelColumn,
  DashboardDataModel,
} from '../generated/entity/data/dashboardDataModel';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { Pipeline } from '../generated/entity/data/pipeline';
import { SearchIndex } from '../generated/entity/data/searchIndex';
import { Column, Table } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { Worksheet } from '../generated/entity/data/worksheet';
import { TagLabel } from '../generated/type/tagLabel';
import {
  ColumnFieldUpdate,
  EntityDataMap,
  EntityDataMapValue,
  HandleColumnFieldUpdateOptions,
  HandleColumnFieldUpdateResult,
} from './ColumnUpdateUtils.interface';
import {
  updateContainerColumnDescription,
  updateContainerColumnTags,
} from './ContainerDetailUtils';
import {
  findFieldByFQN,
  normalizeTags,
  pruneEmptyChildren,
  updateFieldDescription,
  updateFieldDisplayName,
  updateFieldExtension,
  updateFieldTags,
} from './TableUtils';

// Re-export for backward compatibility
export type { ColumnFieldUpdate } from './ColumnUpdateUtils.interface';

/**
 * Result of a column update operation
 */
export interface ColumnUpdateResult<T> {
  updatedEntity: T;
  updatedColumn: Column | DataModelColumn | Field | undefined;
}

/**
 * Convert TagLabel array to EntityTags array
 * Only adds isRemovable if it doesn't already exist
 */
const toEntityTags = (tags: TagLabel[]): EntityTags[] =>
  tags.map((tag) => {
    const tagWithRemovable = tag as EntityTags;

    return {
      ...tag,
      ...(isUndefined(tagWithRemovable.isRemovable) && { isRemovable: true }),
    } as EntityTags;
  });

/**
 * Update Topic schema field
 */
export const updateTopicField = (
  topic: Topic,
  fqn: string,
  update: ColumnFieldUpdate
): { updatedTopic: Topic; updatedColumn: Column | undefined } => {
  const schemaFields = cloneDeep(topic.messageSchema?.schemaFields ?? []);

  if (!isUndefined(update.description)) {
    updateFieldDescription(fqn, update.description, schemaFields);
  }
  if (!isUndefined(update.tags)) {
    const normalizedTags = normalizeTags(update.tags);
    updateFieldTags(fqn, toEntityTags(normalizedTags), schemaFields);
  }

  const updatedTopic: Topic = {
    ...topic,
    messageSchema: {
      ...topic.messageSchema,
      schemaFields,
    },
  };

  const updatedColumn = findFieldByFQN(schemaFields, fqn) as Column | undefined;

  return { updatedTopic, updatedColumn };
};

/**
 * Update SearchIndex field
 */
export const updateSearchIndexField = (
  searchIndex: SearchIndex,
  fqn: string,
  update: ColumnFieldUpdate
): { updatedSearchIndex: SearchIndex; updatedColumn: Column | undefined } => {
  const fields = cloneDeep(searchIndex.fields ?? []);

  if (!isUndefined(update.description)) {
    updateFieldDescription(fqn, update.description, fields);
  }
  if (!isUndefined(update.tags)) {
    const normalizedTags = normalizeTags(update.tags);
    updateFieldTags(fqn, toEntityTags(normalizedTags), fields);
  }

  const updatedSearchIndex: SearchIndex = {
    ...searchIndex,
    fields,
  };

  const updatedColumn = findFieldByFQN(fields, fqn) as Column | undefined;

  return { updatedSearchIndex, updatedColumn };
};

/**
 * Update Container column
 */
export const updateContainerColumn = (
  container: Container,
  fqn: string,
  update: ColumnFieldUpdate
): { updatedContainer: Container; updatedColumn: Column | undefined } => {
  if (!container.dataModel) {
    return { updatedContainer: container, updatedColumn: undefined };
  }

  const dataModel = cloneDeep(container.dataModel);
  const columns = cloneDeep(dataModel.columns ?? []);

  if (!isUndefined(update.description)) {
    updateContainerColumnDescription(columns, fqn, update.description);
  }
  if (!isUndefined(update.tags)) {
    const normalizedTags = normalizeTags(update.tags);
    updateContainerColumnTags(columns, fqn, toEntityTags(normalizedTags));
  }

  const updatedContainer: Container = {
    ...container,
    dataModel: {
      ...dataModel,
      columns,
    },
  };

  const updatedColumn = findFieldByFQN(columns, fqn) as Column | undefined;

  return { updatedContainer, updatedColumn };
};

/**
 * Update MLModel feature
 */
export const updateMlModelFeature = (
  mlModel: Mlmodel,
  fqn: string,
  update: ColumnFieldUpdate
): { updatedMlModel: Mlmodel; updatedColumn: Column | undefined } => {
  const mlFeatures = cloneDeep(mlModel.mlFeatures ?? []);

  const updatedFeatures = mlFeatures.map((feature) => {
    if (feature.fullyQualifiedName === fqn) {
      return {
        ...feature,
        ...(!isUndefined(update.description) && {
          description: update.description,
        }),
        ...(!isUndefined(update.tags) && {
          tags: normalizeTags(update.tags),
        }),
      };
    }

    return feature;
  });

  const updatedMlModel: Mlmodel = {
    ...mlModel,
    mlFeatures: updatedFeatures,
  };

  const updatedColumn = updatedFeatures.find(
    (f) => f.fullyQualifiedName === fqn
  ) as Column | undefined;

  return { updatedMlModel, updatedColumn };
};

/**
 * Update Pipeline task
 */
export const updatePipelineTask = (
  pipeline: Pipeline,
  fqn: string,
  update: ColumnFieldUpdate
): { updatedPipeline: Pipeline; updatedColumn: Column | undefined } => {
  const tasks = cloneDeep(pipeline.tasks ?? []);

  const updatedTasks = tasks.map((task) => {
    if (task.fullyQualifiedName === fqn) {
      return {
        ...task,
        ...(!isUndefined(update.description) && {
          description: update.description,
        }),
        ...(!isUndefined(update.tags) && {
          tags: normalizeTags(update.tags),
        }),
      };
    }

    return task;
  });

  const updatedPipeline: Pipeline = {
    ...pipeline,
    tasks: updatedTasks,
  };

  const updatedColumn = updatedTasks.find(
    (t) => t.fullyQualifiedName === fqn
  ) as Column | undefined;

  return { updatedPipeline, updatedColumn };
};

/**
 * Update Table column
 * Returns the updated table and column (local data modification only)
 */
export const updateTableColumn = (
  table: Table,
  fqn: string,
  update: ColumnFieldUpdate
): { updatedTable: Table; updatedColumn: Column | undefined } => {
  const columns = cloneDeep(table.columns ?? []);

  if (!isUndefined(update.description)) {
    updateFieldDescription(fqn, update.description, columns);
  }

  if (!isUndefined(update.tags)) {
    const normalizedTags = normalizeTags(update.tags);
    updateFieldTags(fqn, toEntityTags(normalizedTags), columns);
  }

  if (!isUndefined(update.extension)) {
    updateFieldExtension(fqn, update.extension, columns);
  }

  if (!isUndefined(update.displayName)) {
    updateFieldDisplayName(fqn, update.displayName, columns);
  }

  const updatedTable: Table = {
    ...table,
    columns: pruneEmptyChildren(columns),
  };

  const updatedColumn = findFieldByFQN<Column>(columns, fqn);

  return { updatedTable, updatedColumn };
};

/**
 * Update DashboardDataModel column
 * Returns the updated data model and column (local data modification only)
 */
export const updateDataModelColumn = (
  dataModel: DashboardDataModel,
  fqn: string,
  update: ColumnFieldUpdate
): {
  updatedDataModel: DashboardDataModel;
  updatedColumn: DataModelColumn | undefined;
} => {
  const columns = cloneDeep(dataModel.columns ?? []);

  if (!isUndefined(update.description)) {
    updateFieldDescription(fqn, update.description, columns);
  }

  if (!isUndefined(update.tags)) {
    const normalizedTags = normalizeTags(update.tags);
    updateFieldTags(fqn, toEntityTags(normalizedTags), columns);
  }

  if (!isUndefined(update.displayName)) {
    updateFieldDisplayName(fqn, update.displayName, columns);
  }

  const updatedDataModel: DashboardDataModel = {
    ...dataModel,
    columns: pruneEmptyChildren(columns),
  };

  const updatedColumn = findFieldByFQN<DataModelColumn>(columns, fqn);

  return { updatedDataModel, updatedColumn };
};

/**
 * Update Worksheet column
 * Returns the updated worksheet and column (local data modification only)
 */
export const updateWorksheetColumn = (
  worksheet: Worksheet,
  fqn: string,
  update: ColumnFieldUpdate
): { updatedWorksheet: Worksheet; updatedColumn: Column | undefined } => {
  const columns = cloneDeep(worksheet.columns ?? []);

  if (!isUndefined(update.description)) {
    updateFieldDescription(fqn, update.description, columns);
  }

  if (!isUndefined(update.tags)) {
    const normalizedTags = normalizeTags(update.tags);
    updateFieldTags(fqn, toEntityTags(normalizedTags), columns);
  }

  const updatedWorksheet: Worksheet = {
    ...worksheet,
    columns: pruneEmptyChildren(columns),
  };

  const updatedColumn = findFieldByFQN<Column>(columns, fqn);

  return { updatedWorksheet, updatedColumn };
};

/**
 * Update APIEndpoint schema field
 */
export const updateApiEndpointField = (
  apiEndpoint: APIEndpoint,
  fqn: string,
  update: ColumnFieldUpdate
): { updatedApiEndpoint: APIEndpoint; updatedColumn: Field | undefined } => {
  // Use recursive findFieldByFQN to determine which schema contains this field
  const requestField = findFieldByFQN<Field>(
    apiEndpoint.requestSchema?.schemaFields ?? [],
    fqn
  );
  const responseField = findFieldByFQN<Field>(
    apiEndpoint.responseSchema?.schemaFields ?? [],
    fqn
  );

  let schemaKey: 'requestSchema' | 'responseSchema' | null = null;
  let schema = null;

  if (requestField) {
    schemaKey = 'requestSchema';
    schema = apiEndpoint.requestSchema;
  } else if (responseField) {
    schemaKey = 'responseSchema';
    schema = apiEndpoint.responseSchema;
  }

  if (!schema || !schemaKey) {
    return { updatedApiEndpoint: apiEndpoint, updatedColumn: undefined };
  }

  const schemaFields = cloneDeep(schema.schemaFields ?? []);

  // Use recursive utilities to update nested fields
  if (!isUndefined(update.description)) {
    updateFieldDescription<Field>(fqn, update.description, schemaFields);
  }

  if (!isUndefined(update.tags)) {
    const normalizedTags = normalizeTags(update.tags);
    updateFieldTags<Field>(fqn, toEntityTags(normalizedTags), schemaFields);
  }

  const updatedApiEndpoint: APIEndpoint = {
    ...apiEndpoint,
    [schemaKey]: {
      ...schema,
      schemaFields,
    },
  };

  // Use recursive findFieldByFQN to find nested fields
  const updatedColumn = findFieldByFQN<Field>(schemaFields, fqn);

  return { updatedApiEndpoint, updatedColumn };
};

/**
 * Supported entity types for column updates
 */
export type ColumnUpdateEntityType =
  | EntityType.TABLE
  | EntityType.TOPIC
  | EntityType.SEARCH_INDEX
  | EntityType.CONTAINER
  | EntityType.MLMODEL
  | EntityType.PIPELINE
  | EntityType.DASHBOARD_DATA_MODEL
  | EntityType.API_ENDPOINT
  | EntityType.WORKSHEET;

/**
 * Check if entity type supports column updates
 */
export const supportsColumnUpdates = (
  entityType: EntityType
): entityType is ColumnUpdateEntityType => {
  return [
    EntityType.TABLE,
    EntityType.TOPIC,
    EntityType.SEARCH_INDEX,
    EntityType.CONTAINER,
    EntityType.MLMODEL,
    EntityType.PIPELINE,
    EntityType.DASHBOARD_DATA_MODEL,
    EntityType.API_ENDPOINT,
    EntityType.WORKSHEET,
  ].includes(entityType);
};

/**
 * Unified handler for column field updates across all entity types.
 * Returns the updated entity and column/field (local data modification only).
 */
export const handleColumnFieldUpdate = <T extends EntityDataMapValue>({
  entityType,
  entityData,
  fqn,
  update,
}: HandleColumnFieldUpdateOptions<T>): HandleColumnFieldUpdateResult<T> => {
  switch (entityType) {
    case EntityType.TOPIC: {
      const topic = entityData as EntityDataMap[EntityType.TOPIC];
      const { updatedTopic, updatedColumn } = updateTopicField(
        topic,
        fqn,
        update
      );

      return {
        updatedEntity: updatedTopic as T,
        updatedColumn,
      };
    }

    case EntityType.SEARCH_INDEX: {
      const searchIndex = entityData as EntityDataMap[EntityType.SEARCH_INDEX];
      const { updatedSearchIndex, updatedColumn } = updateSearchIndexField(
        searchIndex,
        fqn,
        update
      );

      return {
        updatedEntity: updatedSearchIndex as T,
        updatedColumn,
      };
    }

    case EntityType.CONTAINER: {
      const container = entityData as EntityDataMap[EntityType.CONTAINER];
      const { updatedContainer, updatedColumn } = updateContainerColumn(
        container,
        fqn,
        update
      );

      return {
        updatedEntity: updatedContainer as T,
        updatedColumn,
      };
    }

    case EntityType.MLMODEL: {
      const mlModel = entityData as EntityDataMap[EntityType.MLMODEL];
      const { updatedMlModel, updatedColumn } = updateMlModelFeature(
        mlModel,
        fqn,
        update
      );

      return {
        updatedEntity: updatedMlModel as T,
        updatedColumn,
      };
    }

    case EntityType.PIPELINE: {
      const pipeline = entityData as EntityDataMap[EntityType.PIPELINE];
      const { updatedPipeline, updatedColumn } = updatePipelineTask(
        pipeline,
        fqn,
        update
      );

      return {
        updatedEntity: updatedPipeline as T,
        updatedColumn,
      };
    }

    case EntityType.TABLE: {
      const table = entityData as EntityDataMap[EntityType.TABLE];
      const { updatedTable, updatedColumn } = updateTableColumn(
        table,
        fqn,
        update
      );

      return {
        updatedEntity: updatedTable as T,
        updatedColumn,
      };
    }

    case EntityType.DASHBOARD_DATA_MODEL: {
      const dataModel =
        entityData as EntityDataMap[EntityType.DASHBOARD_DATA_MODEL];
      const { updatedDataModel, updatedColumn } = updateDataModelColumn(
        dataModel,
        fqn,
        update
      );

      return {
        updatedEntity: updatedDataModel as T,
        updatedColumn,
      };
    }

    case EntityType.API_ENDPOINT: {
      const apiEndpoint = entityData as EntityDataMap[EntityType.API_ENDPOINT];
      const { updatedApiEndpoint, updatedColumn } = updateApiEndpointField(
        apiEndpoint,
        fqn,
        update
      );

      return {
        updatedEntity: updatedApiEndpoint as T,
        updatedColumn,
      };
    }

    case EntityType.WORKSHEET: {
      const worksheet = entityData as EntityDataMap[EntityType.WORKSHEET];
      const { updatedWorksheet, updatedColumn } = updateWorksheetColumn(
        worksheet,
        fqn,
        update
      );

      return {
        updatedEntity: updatedWorksheet as unknown as T,
        updatedColumn,
      };
    }

    default:
      return {
        updatedEntity: entityData,
        updatedColumn: undefined,
      };
  }
};
