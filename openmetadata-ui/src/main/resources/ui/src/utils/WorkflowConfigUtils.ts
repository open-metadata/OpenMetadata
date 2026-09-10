/*
 *  Copyright 2025 Collate.
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

import { EntityType } from '../enums/entity.enum';
import { WorkflowDefinition } from '../generated/governance/workflows/workflowDefinition';
import { NodeConfig } from '../interface/workflow-builder-components.interface';

const getEntityTypesFromDataAssets = (
  config: NodeConfig
): EntityType | EntityType[] | undefined => {
  if (!config.dataAssets || config.dataAssets.length === 0) {
    return undefined;
  }

  const entityTypes = config.dataAssets.filter(Boolean);

  if (entityTypes.length > 1) {
    return entityTypes as EntityType[];
  } else if (entityTypes.length === 1) {
    return entityTypes[0] as EntityType;
  }

  return undefined;
};

const mapTriggerEntityTypes = (
  entityTypes: string[]
): EntityType | EntityType[] => {
  const mappedEntityTypes = entityTypes
    .map((entityType: string) => {
      return Object.values(EntityType).includes(entityType as EntityType)
        ? (entityType as EntityType)
        : entityType;
    })
    .filter(Boolean);

  if (mappedEntityTypes.length > 1) {
    return mappedEntityTypes as EntityType[];
  } else if (mappedEntityTypes.length === 1) {
    return mappedEntityTypes[0] as EntityType;
  } else {
    return EntityType.ALL;
  }
};

export const getSelectedEntityTypes = (
  config: NodeConfig,
  workflowDefinition: WorkflowDefinition
): EntityType | EntityType[] => {
  const dataAssetTypes = getEntityTypesFromDataAssets(config);

  if (dataAssetTypes !== undefined) {
    return dataAssetTypes;
  }

  if (!workflowDefinition) {
    return EntityType.ALL;
  }

  const triggerConfig =
    typeof workflowDefinition.trigger === 'object' &&
    workflowDefinition.trigger !== null &&
    !Array.isArray(workflowDefinition.trigger)
      ? workflowDefinition.trigger.config
      : {};

  if (triggerConfig?.entityType) {
    return triggerConfig.entityType;
  }

  if (
    triggerConfig?.entityTypes &&
    Array.isArray(triggerConfig.entityTypes) &&
    triggerConfig.entityTypes.length > 0
  ) {
    return mapTriggerEntityTypes(triggerConfig.entityTypes);
  }

  return EntityType.ALL;
};

const hasRequiredBaseFields = (config: NodeConfig): boolean => {
  const hasName = Boolean(config.name && config.name.trim() !== '');
  const hasTriggerType = Boolean(
    config.triggerType && config.triggerType.trim() !== ''
  );
  const hasDataAssets = Boolean(
    config.dataAssets && config.dataAssets.length > 0
  );

  return hasName && hasTriggerType && hasDataAssets;
};

const validatePeriodicBatchConfig = (config: NodeConfig): boolean => {
  const hasScheduleType = Boolean(
    config.scheduleType && config.scheduleType.trim() !== ''
  );

  // Must have a schedule type selected
  if (!hasScheduleType) {
    return false;
  }

  // If scheduled, validate cron expression
  if (config.scheduleType === 'Scheduled') {
    return Boolean(
      config.cronExpression && config.cronExpression.trim() !== ''
    );
  }

  return true;
};

export const validateWorkflowConfig = (
  config: NodeConfig,
  isStartNode: boolean
): boolean => {
  if (!isStartNode) {
    return true;
  }

  if (!hasRequiredBaseFields(config)) {
    return false;
  }

  const isEventBased = config.triggerType === 'Event Based';
  const isPeriodicBatch = config.triggerType === 'Periodic Batch';

  if (isEventBased) {
    return Boolean(config.eventType && config.eventType.length > 0);
  }

  if (isPeriodicBatch) {
    return validatePeriodicBatchConfig(config);
  }

  return true;
};

export const filterExcludeFields = (
  fields: Array<{ name?: string }>
): Array<{ name?: string }> => {
  return fields.filter((field) => {
    if (!field || !field.name) {
      return false;
    }

    if (field.name.startsWith('column.') || field.name.startsWith('columns.')) {
      return true;
    }

    if (field.name.includes('.')) {
      return false;
    }

    return true;
  });
};
