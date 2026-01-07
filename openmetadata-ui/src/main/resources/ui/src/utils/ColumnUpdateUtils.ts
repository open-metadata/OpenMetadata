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

import { compare } from 'fast-json-patch';
import { cloneDeep } from 'lodash';
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
import { TagLabel } from '../generated/type/tagLabel';
import { updateDataModelColumn } from '../rest/dataModelsAPI';
import {
  getTableDetailsByFQN,
  patchTableDetails,
  updateTableColumn,
} from '../rest/tableAPI';
import { defaultFieldsWithColumns } from './DatasetDetailsUtils';
import {
  updateContainerColumnDescription,
  updateContainerColumnTags,
} from './ContainerDetailUtils';
import {
  findFieldByFQN,
  normalizeTags,
  pruneEmptyChildren,
  updateFieldDescription,
  updateFieldTags,
} from './TableUtils';

/**
 * Column field update payload
 */
export interface ColumnFieldUpdate {
  description?: string;
  tags?: TagLabel[];
}

/**
 * Result of a column update operation
 */
export interface ColumnUpdateResult<T> {
  updatedEntity: T;
  updatedColumn: Column | DataModelColumn | Field | undefined;
}

/**
 * Convert TagLabel array to EntityTags array
 */
const toEntityTags = (tags: TagLabel[]): EntityTags[] =>
  tags.map((tag) => ({ ...tag, isRemovable: true })) as EntityTags[];

/**
 * Update Topic schema field
 */
export const updateTopicField = (
  topic: Topic,
  fqn: string,
  update: ColumnFieldUpdate
): { updatedTopic: Topic; updatedColumn: Column | undefined } => {
  const schemaFields = cloneDeep(topic.messageSchema?.schemaFields ?? []);

  if (update.description !== undefined) {
    updateFieldDescription(fqn, update.description, schemaFields);
  }
  if (update.tags !== undefined) {
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

  if (update.description !== undefined) {
    updateFieldDescription(fqn, update.description, fields);
  }
  if (update.tags !== undefined) {
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

  if (update.description !== undefined) {
    updateContainerColumnDescription(columns, fqn, update.description);
  }
  if (update.tags !== undefined) {
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
        ...(update.description !== undefined && {
          description: update.description,
        }),
        ...(update.tags !== undefined && {
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
        ...(update.description !== undefined && {
          description: update.description,
        }),
        ...(update.tags !== undefined && {
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
 * Update Table column via API
 * Returns the updated table and column
 */
export const updateTableColumnViaApi = async (
  table: Table,
  fqn: string,
  update: ColumnFieldUpdate,
  onUpdate: (
    updatedTable: Table,
    key?: keyof Table,
    skipApiCall?: boolean
  ) => Promise<void>
): Promise<Column | undefined> => {
  const tableId = table.id ?? '';

  // For Table, we update columns via API directly
  const columnUpdate: Partial<Column> = {};

  if (update.description !== undefined) {
    columnUpdate.description = update.description;
  }

  if (update.tags !== undefined) {
    // Normalize tags to remove style property from glossary terms
    const normalizedTags = normalizeTags(update.tags);

    // When clearing all tags (empty array), the backend's JSON patch generation
    // tries to remove tags by index which causes "array item index is out of range" errors.
    // Workaround: Use table-level update instead of column-level update when clearing all tags
    if (normalizedTags.length === 0) {
      // Update via table-level PATCH to avoid index errors
      const columns = cloneDeep(table.columns ?? []);
      const updatedColumn = findFieldByFQN<Column>(columns, fqn);
      if (updatedColumn) {
        updatedColumn.tags = [];
      }

      const updatedTable: Table = {
        ...table,
        columns: pruneEmptyChildren(columns),
      };

      // Use compare to generate patch from current table state
      const jsonPatch = compare(table, updatedTable);
      const res = await patchTableDetails(tableId, jsonPatch);

      // Update state with the response to ensure consistency
      await onUpdate(res);

      // Return the updated column from the API response
      return findFieldByFQN<Column>(res.columns ?? [], fqn);
    }

    columnUpdate.tags = normalizedTags;
  }

  // Update the column via API
  await updateTableColumn(fqn, columnUpdate);

  // Fetch the full table from the backend to ensure we have the latest state.
  // This prevents "array item index is out of range" errors when onTableUpdate
  // generates a patch, because we'll skip the API call since the backend is already updated.
  // We use defaultFieldsWithColumns to ensure columns with tags are included in the response.
  const tableFQN = table.fullyQualifiedName ?? '';
  const fetchedTable = await getTableDetailsByFQN(tableFQN, {
    fields: defaultFieldsWithColumns,
  });

  // Update state with the fetched table, skipping the API call since backend is already updated
  await onUpdate(fetchedTable, undefined, true);

  // Find and return the updated column from the fetched table
  return findFieldByFQN<Column>(fetchedTable.columns ?? [], fqn);
};

/**
 * Update DashboardDataModel column via API
 */
export const updateDataModelColumnViaApi = async (
  dataModel: DashboardDataModel,
  fqn: string,
  update: ColumnFieldUpdate,
  onUpdate: (updatedDataModel: DashboardDataModel) => Promise<void>
): Promise<DataModelColumn | undefined> => {
  // For DashboardDataModel, we update columns via API directly
  const columnUpdate: Partial<DataModelColumn> = {};

  if (update.description !== undefined) {
    columnUpdate.description = update.description;
  }

  if (update.tags !== undefined) {
    columnUpdate.tags = normalizeTags(update.tags);
  }

  const response = await updateDataModelColumn(fqn, columnUpdate);

  // Update local state using recursive findFieldByFQN to handle nested columns
  const columns = cloneDeep(dataModel.columns ?? []);
  const updatedColumn = findFieldByFQN<DataModelColumn>(columns, fqn);
  if (updatedColumn) {
    Object.assign(updatedColumn, response);
  }

  const updatedDataModel: DashboardDataModel = {
    ...dataModel,
    columns,
  };

  await onUpdate(updatedDataModel);

  // Find the updated column to return
  return findFieldByFQN<DataModelColumn>(columns, fqn);
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

  const schemaKey = requestField
    ? 'requestSchema'
    : responseField
      ? 'responseSchema'
      : null;
  const schema = requestField
    ? apiEndpoint.requestSchema
    : responseField
      ? apiEndpoint.responseSchema
      : null;

  if (!schema || !schemaKey) {
    return { updatedApiEndpoint: apiEndpoint, updatedColumn: undefined };
  }

  const schemaFields = cloneDeep(schema.schemaFields ?? []);

  // Use recursive utilities to update nested fields
  if (update.description !== undefined) {
    updateFieldDescription<Field>(fqn, update.description, schemaFields);
  }

  if (update.tags !== undefined) {
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
  | EntityType.API_ENDPOINT;

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
  ].includes(entityType);
};

/**
 * Entity data type mapping for column updates
 */
type EntityDataMap = {
  [EntityType.TABLE]: Table;
  [EntityType.TOPIC]: Topic;
  [EntityType.SEARCH_INDEX]: SearchIndex;
  [EntityType.CONTAINER]: Container;
  [EntityType.MLMODEL]: Mlmodel;
  [EntityType.PIPELINE]: Pipeline;
  [EntityType.DASHBOARD_DATA_MODEL]: DashboardDataModel;
  [EntityType.API_ENDPOINT]: APIEndpoint;
};

/**
 * Options for handleColumnFieldUpdate
 */
export interface HandleColumnFieldUpdateOptions<T> {
  entityType: EntityType;
  entityData: T;
  fqn: string;
  update: ColumnFieldUpdate;
  onUpdate: (updatedEntity: T, key?: keyof T, skipApiCall?: boolean) => Promise<void>;
}

/**
 * Unified handler for column field updates across all entity types.
 * Returns the updated column/field after the update is complete.
 */
export const handleColumnFieldUpdate = async <T>({
  entityType,
  entityData,
  fqn,
  update,
  onUpdate,
}: HandleColumnFieldUpdateOptions<T>): Promise<Column | DataModelColumn | Field | undefined> => {
  switch (entityType) {
    case EntityType.TOPIC: {
      const topic = entityData as EntityDataMap[EntityType.TOPIC];
      const { updatedTopic, updatedColumn } = updateTopicField(topic, fqn, update);
      await onUpdate(updatedTopic as T);

      return updatedColumn;
    }

    case EntityType.SEARCH_INDEX: {
      const searchIndex = entityData as EntityDataMap[EntityType.SEARCH_INDEX];
      const { updatedSearchIndex, updatedColumn } = updateSearchIndexField(searchIndex, fqn, update);
      await onUpdate(updatedSearchIndex as T);

      return updatedColumn;
    }

    case EntityType.CONTAINER: {
      const container = entityData as EntityDataMap[EntityType.CONTAINER];
      const { updatedContainer, updatedColumn } = updateContainerColumn(container, fqn, update);
      await onUpdate(updatedContainer as T);

      return updatedColumn;
    }

    case EntityType.MLMODEL: {
      const mlModel = entityData as EntityDataMap[EntityType.MLMODEL];
      const { updatedMlModel, updatedColumn } = updateMlModelFeature(mlModel, fqn, update);
      await onUpdate(updatedMlModel as T);

      return updatedColumn;
    }

    case EntityType.PIPELINE: {
      const pipeline = entityData as EntityDataMap[EntityType.PIPELINE];
      const { updatedPipeline, updatedColumn } = updatePipelineTask(pipeline, fqn, update);
      await onUpdate(updatedPipeline as T);

      return updatedColumn;
    }

    case EntityType.TABLE: {
      const table = entityData as EntityDataMap[EntityType.TABLE];
      const tableOnUpdate = async (
        updatedTable: Table,
        key?: keyof Table,
        skipApiCall?: boolean
      ) => {
        await (onUpdate as (entity: Table, key?: keyof Table, skipApiCall?: boolean) => Promise<void>)(
          updatedTable,
          key,
          skipApiCall
        );
      };

      return updateTableColumnViaApi(table, fqn, update, tableOnUpdate);
    }

    case EntityType.DASHBOARD_DATA_MODEL: {
      const dataModel = entityData as EntityDataMap[EntityType.DASHBOARD_DATA_MODEL];
      const dataModelOnUpdate = async (updatedDataModel: DashboardDataModel) => {
        await onUpdate(updatedDataModel as T);
      };

      return updateDataModelColumnViaApi(dataModel, fqn, update, dataModelOnUpdate);
    }

    case EntityType.API_ENDPOINT: {
      const apiEndpoint = entityData as EntityDataMap[EntityType.API_ENDPOINT];
      const { updatedApiEndpoint, updatedColumn } = updateApiEndpointField(apiEndpoint, fqn, update);
      await onUpdate(updatedApiEndpoint as T);

      return updatedColumn;
    }

    default:
      return undefined;
  }
};

