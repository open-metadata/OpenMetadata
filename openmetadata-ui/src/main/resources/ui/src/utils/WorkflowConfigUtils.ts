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

import { isPlainObject, omit } from 'lodash';
import { Node } from 'reactflow';
import { EntityType } from '../enums/entity.enum';
import { SinkType } from '../generated/governance/workflows/elements/nodes/automatedTask/sinkTask';
import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';
import { NodeConfig } from '../interface/workflow-builder-components.interface';
import { t } from './i18next/LocalUtil';

export const getSelectedEntityTypes = (
  config: NodeConfig,
  workflowDefinition: any
): EntityType | EntityType[] => {
  if (config.dataAssets && config.dataAssets.length > 0) {
    const entityTypes = config.dataAssets.filter(Boolean);

    if (entityTypes.length > 1) {
      return entityTypes as EntityType[];
    } else if (entityTypes.length === 1) {
      return entityTypes[0] as EntityType;
    }
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
    const mappedEntityTypes = triggerConfig.entityTypes
      .map((entityType: string) => {
        return Object.values(EntityType).includes(entityType as EntityType)
          ? (entityType as EntityType)
          : entityType;
      })
      .filter(Boolean);

    if (mappedEntityTypes.length > 1) {
      return mappedEntityTypes;
    } else if (mappedEntityTypes.length === 1) {
      return mappedEntityTypes[0];
    } else {
      return EntityType.ALL;
    }
  }

  return EntityType.ALL;
};

export const validateWorkflowConfig = (
  config: NodeConfig,
  isStartNode: boolean
): boolean => {
  if (!isStartNode) {
    return true;
  }

  const hasName = Boolean(config.name && config.name.trim() !== '');
  const hasTriggerType = Boolean(
    config.triggerType && config.triggerType.trim() !== ''
  );
  const hasDataAssets = Boolean(
    config.dataAssets && config.dataAssets.length > 0
  );

  if (!hasName || !hasTriggerType || !hasDataAssets) {
    return false;
  }

  const isEventBased = config.triggerType === 'Event Based';
  const isPeriodicBatch = config.triggerType === 'Periodic Batch';

  if (isEventBased) {
    const hasEventType = Boolean(
      config.eventType && config.eventType.length > 0
    );

    return hasEventType;
  }

  if (isPeriodicBatch) {
    const hasScheduleType = Boolean(
      config.scheduleType && config.scheduleType.trim() !== ''
    );

    // Must have a schedule type selected
    if (!hasScheduleType) {
      return false;
    }

    // If scheduled, validate cron expression
    if (config.scheduleType === 'Scheduled') {
      const hasCronExpression = Boolean(
        config.cronExpression && config.cronExpression.trim() !== ''
      );

      return hasCronExpression;
    }

    return true;
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

export const EXTENSION_FIELD_PREFIX = 'extension.';

// Custom properties are addressed as extension.<name> everywhere in the workflow builder.
export const withExtensionPrefix = (name: string): string =>
  `${EXTENSION_FIELD_PREFIX}${name}`;

// Inverse of withExtensionPrefix: the bare name shown to the user.
export const getFieldLabel = (value: string): string =>
  value.startsWith(EXTENSION_FIELD_PREFIX)
    ? value.slice(EXTENSION_FIELD_PREFIX.length)
    : value;

// Display label for a workflow field option: the bare name, with custom properties
// marked so a custom property and a same-named standard field stay distinguishable.
export const getFieldDisplayLabel = (value: string): string =>
  value.startsWith(EXTENSION_FIELD_PREFIX)
    ? `${getFieldLabel(value)} (${t('label.custom-property')})`
    : getFieldLabel(value);

/**
 * Builds the de-duplicated field-option list for a workflow field picker.
 *
 * Custom properties are stored under `extension.<name>` and workflow nodes resolve a field path
 * against the entity, where a custom property is only reachable at that path. The fields API returns
 * custom properties by their bare name, so prefix those (and only those) with `extension.`, matching
 * how the trigger/filter field lists are built (see NodeConfigSidebar). Standard fields are left
 * as-is. The prefix is applied after {@link filterExcludeFields} so the added dot does not exclude
 * the property.
 *
 * Call this per entity type (each type's own custom properties) and merge the results, so a custom
 * property on one type does not prefix a standard field of the same name on another type.
 */
export const buildFieldOptions = (
  fields: Array<{ name?: string }>,
  customPropertyNames: Set<string>
): string[] => {
  const seen = new Set<string>();
  const options: string[] = [];

  filterExcludeFields(fields).forEach(({ name }) => {
    if (!name) {
      return;
    }

    const value = customPropertyNames.has(name)
      ? withExtensionPrefix(name)
      : name;

    if (!seen.has(value)) {
      seen.add(value);
      options.push(value);
    }
  });

  return options;
};

/**
 * Whether a builder node writes to a Git sink. The builder's sink form saves every sink as a Git
 * sink, so a sink node not configured yet counts as one.
 */
export const isGitSinkNode = (node: Node): boolean =>
  node.data?.subType === NodeSubType.SinkTask &&
  (node.data?.config?.sinkType ?? SinkType.Git) === SinkType.Git;

// Query entities are not synced to a Git sink.
const isGitSinkSyncedEntityType = (entityType: string): boolean =>
  entityType !== EntityType.QUERY;

/**
 * Entity types a workflow's trigger can be defined on. Query entities are not synced to a Git sink,
 * so a workflow with one offers neither them nor an "All" that includes them.
 */
export const getTriggerDataAssets = (
  entityTypes: string[],
  hasGitSinkNode: boolean
): string[] =>
  hasGitSinkNode ? entityTypes.filter(isGitSinkSyncedEntityType) : entityTypes;

/**
 * The trigger's selected data assets and their filters, limited to the entity types a Git sink
 * syncs.
 */
export const getGitSinkTriggerNodeConfig = (
  config: NodeConfig
): NodeConfig => ({
  ...config,
  dataAssets: config.dataAssets.filter(isGitSinkSyncedEntityType),
  dataAssetFilters: config.dataAssetFilters.filter((dataAssetFilter) =>
    isGitSinkSyncedEntityType(dataAssetFilter.dataAsset)
  ),
});

// A trigger filter is a string applied to every entity type, or an object keyed by entity type.
const getGitSinkTriggerFilter = (filter: unknown): unknown =>
  isPlainObject(filter) ? omit(filter as object, EntityType.QUERY) : filter;

/**
 * A trigger config limited to the entity types a Git sink syncs: in its entity types and in its
 * per-entity-type `filter` (event-based) and `filters` (periodic batch).
 */
export const getGitSinkTriggerConfig = (
  triggerConfig: Record<string, unknown>
): Record<string, unknown> => {
  const { entityTypes, filter, filters } = triggerConfig;

  return {
    ...triggerConfig,
    ...(Array.isArray(entityTypes) && {
      entityTypes: entityTypes.filter(isGitSinkSyncedEntityType),
    }),
    ...(filter !== undefined && { filter: getGitSinkTriggerFilter(filter) }),
    ...(filters !== undefined && {
      filters: getGitSinkTriggerFilter(filters),
    }),
  };
};
