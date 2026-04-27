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

import React from 'react';
import {
  AVAILABLE_OPTIONS,
  WorkflowType,
} from '../../../../constants/WorkflowBuilder.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { NodeConfig } from '../../../../interface/workflow-builder-components.interface';
import {
  DataAssetFiltersSection,
  DataAssetFormSection,
  EventTriggerFilterSection,
  MetadataFormSection,
  TriggerConfigSection,
} from './';

interface WorkflowConfigFormV1Props {
  config: NodeConfig;
  availableEventTypes: string[];
  availableExcludeFields: string[];
  allowFullStartNodeConfiguration: boolean;
  allowStartNodeFilterScheduleAndBatchEdit: boolean;
  allowScheduledTrigger: boolean;
  updateConfig: <K extends keyof NodeConfig>(
    key: K,
    value: NodeConfig[K]
  ) => void;
  removeFromArray: <K extends keyof NodeConfig>(
    key: K,
    itemToRemove: string
  ) => void;
  handleEventTypeChange: (event: { target: { value: string[] } }) => void;
  addDataAssetFilter: (dataAsset?: string) => void;
  onUpdateDataAssetFilter: (dataAssetId: number, value: string) => void;
  removeDataAssetFilter: (dataAssetId: number) => void;
}

function getEventTriggerEntityType(
  dataAssets: string[] | undefined
): EntityType {
  if (dataAssets?.length === 1) {
    return dataAssets[0] as EntityType;
  }

  return EntityType.ALL;
}

export const WorkflowConfigFormV1: React.FC<WorkflowConfigFormV1Props> = ({
  config,
  availableEventTypes,
  availableExcludeFields,
  allowFullStartNodeConfiguration,
  allowStartNodeFilterScheduleAndBatchEdit,
  allowScheduledTrigger,
  updateConfig,
  removeFromArray,
  handleEventTypeChange,
  addDataAssetFilter,
  onUpdateDataAssetFilter,
  removeDataAssetFilter,
}) => {
  const lockCoreStartFields = !allowFullStartNodeConfiguration;
  const canEditFiltersAndPeriodicSchedule =
    allowFullStartNodeConfiguration || allowStartNodeFilterScheduleAndBatchEdit;
  const lockFilterSections = !canEditFiltersAndPeriodicSchedule;

  return (
    <div data-testid="workflow-config-form-v1">
      <MetadataFormSection
        isStartNode
        description={config.description}
        lockDescriptionField={false}
        lockFields={lockCoreStartFields}
        name={config.name}
        onDescriptionChange={(description) =>
          updateConfig('description', description)
        }
        onNameChange={(name) => updateConfig('name', name)}
      />

      <DataAssetFormSection
        availableDataAssets={[...AVAILABLE_OPTIONS.DATA_ASSETS]}
        dataAssets={config.dataAssets}
        lockFields={lockCoreStartFields}
        onDataAssetsChange={(dataAssets) =>
          updateConfig('dataAssets', dataAssets)
        }
        onRemoveDataAsset={(asset) => removeFromArray('dataAssets', asset)}
      />

      {config.triggerType === WorkflowType.PERIODIC_BATCH && (
        <DataAssetFiltersSection
          dataAssetFilters={config.dataAssetFilters || []}
          dataAssets={config.dataAssets || []}
          lockFields={lockFilterSections}
          onAddDataAssetFilter={addDataAssetFilter}
          onRemoveDataAssetFilter={removeDataAssetFilter}
          onUpdateDataAssetFilter={onUpdateDataAssetFilter}
        />
      )}

      <TriggerConfigSection
        availableEventTypes={availableEventTypes}
        availableExcludeFields={availableExcludeFields}
        batchSize={config.batchSize}
        cronExpression={config.cronExpression}
        eventType={config.eventType}
        excludeFields={config.excludeFields}
        include={config.include}
        lockNonIncludeExcludeFields={lockCoreStartFields}
        lockPeriodicBatchFields={lockFilterSections}
        lockScheduleTypeField={!allowScheduledTrigger}
        scheduleType={config.scheduleType}
        triggerType={config.triggerType}
        onBatchSizeChange={(batchSize) => updateConfig('batchSize', batchSize)}
        onCronExpressionChange={(cron) => updateConfig('cronExpression', cron)}
        onEventTypeChange={handleEventTypeChange}
        onExcludeFieldsChange={(excludeFields) =>
          updateConfig('excludeFields', excludeFields)
        }
        onIncludeChange={(include) => updateConfig('include', include)}
        onRemoveEventType={(eventType) =>
          removeFromArray('eventType', eventType)
        }
        onRemoveExcludeField={(fieldToRemove) =>
          removeFromArray('excludeFields', fieldToRemove)
        }
        onRemoveInclude={(fieldToRemove) =>
          removeFromArray('include', fieldToRemove)
        }
        onScheduleTypeChange={(scheduleType) =>
          updateConfig('scheduleType', scheduleType)
        }
        onTriggerTypeChange={(triggerType) =>
          updateConfig('triggerType', triggerType)
        }
      />

      {config.triggerType === WorkflowType.EVENT_BASED && (
        <EventTriggerFilterSection
          entityType={getEventTriggerEntityType(config.dataAssets)}
          lockFields={lockFilterSections}
          triggerFilter={config.triggerFilter}
          onTriggerFilterChange={(filter) =>
            updateConfig('triggerFilter', filter)
          }
        />
      )}
    </div>
  );
};
