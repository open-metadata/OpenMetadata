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

import {
  Divider,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Node } from 'reactflow';
import {
  AVAILABLE_OPTIONS,
  DEFAULT_QUALITY_BANDS,
  WorkflowType,
} from '../../../constants/WorkflowBuilder.constants';
import { useWorkflowModeContext } from '../../../contexts/WorkflowModeContext';
import { WorkflowTriggerFields } from '../../../generated/type/workflowTriggerFields';
import {
  BackendNodeConfig,
  DataAssetFilter,
  NodeConfig,
  NodeConfigSidebarProps,
} from '../../../interface/workflow-builder-components.interface';
import { getCustomPropertiesByEntityType } from '../../../rest/metadataTypeAPI';
import {
  convertDisplayToBackendTriggerType,
  getInitialNodeConfig,
  getNodeTitle,
  isStartNode,
} from '../../../utils/NodeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { validateWorkflowConfig } from '../../../utils/WorkflowConfigUtils';
import {
  serializeDataAssetFilters,
  serializeEventBasedFilters,
  serializePeriodicBatchFilters,
} from '../../../utils/WorkflowSerializationUtils';
import { FormActionButtons, WorkflowConfigFormV1 } from './forms';

const getBackendConfig = (node: Node | null): BackendNodeConfig => {
  const nodeConfig = node?.data?.config || {};

  return {
    rules: nodeConfig?.rules,
    ruleTemplate: 'hasDescription',
    fieldName: nodeConfig?.fieldName || 'tier',
    fieldValue: nodeConfig?.fieldValue || 'Tier.Tier1',
    qualityBands: nodeConfig?.qualityBands || DEFAULT_QUALITY_BANDS,
    fieldsToCheck: nodeConfig?.fieldsToCheck || ['columns.description'],
    approvalThreshold: nodeConfig?.approvalThreshold || 1,
    rejectionThreshold: nodeConfig?.rejectionThreshold || 1,
  };
};

export const NodeConfigSidebar: React.FC<NodeConfigSidebarProps> = ({
  node,
  isOpen,
  onClose,
  onSave,
  workflowDefinition,
  workflowMetadata,
  onWorkflowMetadataUpdate,
}) => {
  const {
    allowFullStartNodeConfiguration,
    allowStartNodeFilterScheduleAndBatchEdit,
    allowScheduledTrigger,
  } = useWorkflowModeContext();
  const [isUpdating, setIsUpdating] = useState(false);
  const [backendConfig, setBackendConfig] = useState(() =>
    getBackendConfig(node)
  );

  const [localName, setLocalName] = useState<string | null>(null);
  const [localDescription, setLocalDescription] = useState<string | null>(null);
  const [localConfig, setLocalConfig] = useState<NodeConfig | null>(null);

  const config = useMemo(() => {
    if (isStartNode(node) && node) {
      const baseConfig = getInitialNodeConfig(node, workflowDefinition, null);

      if (workflowMetadata) {
        const configWithMetadata = {
          ...baseConfig,
          name: workflowMetadata.displayName || baseConfig.name,
          description: workflowMetadata.description || baseConfig.description,
        };

        return {
          ...configWithMetadata,
          name: localName !== null ? localName : configWithMetadata.name,
          description:
            localDescription !== null
              ? localDescription
              : configWithMetadata.description,
        };
      }

      return {
        ...baseConfig,
        name: localName !== null ? localName : baseConfig.name,
        description:
          localDescription !== null ? localDescription : baseConfig.description,
      };
    }

    return node
      ? getInitialNodeConfig(node, workflowDefinition, null)
      : getInitialNodeConfig({} as Node, workflowDefinition, null);
  }, [node, workflowDefinition, workflowMetadata, localName, localDescription]);

  const effectiveConfig = localConfig || config;

  const [customPropertyFields, setCustomPropertyFields] = useState<string[]>(
    []
  );

  useEffect(() => {
    const assets = effectiveConfig.dataAssets ?? [];
    if (assets.length === 0) {
      setCustomPropertyFields([]);

      return;
    }

    Promise.all(assets.map((asset) => getCustomPropertiesByEntityType(asset)))
      .then((results) => {
        const names = [
          ...new Set(results.flat().map((p) => `extension.${p.name}`)),
        ];
        setCustomPropertyFields(names);
      })
      .catch(() => setCustomPropertyFields([]));
  }, [effectiveConfig.dataAssets]);

  const availableExcludeFields = useMemo(() => {
    return [...Object.values(WorkflowTriggerFields), ...customPropertyFields];
  }, [customPropertyFields]);

  useEffect(() => {
    if (isStartNode(node)) {
      setLocalName(null);
      setLocalDescription(null);
    }
  }, [
    node?.id,
    workflowDefinition?.id,
    workflowMetadata?.displayName,
    workflowMetadata?.description,
  ]);

  const updateConfig = useCallback(
    <K extends keyof NodeConfig>(key: K, value: NodeConfig[K]) => {
      setLocalConfig((prevConfig) => ({
        ...(prevConfig || effectiveConfig),
        [key]: value,
      }));

      if (key === 'name') {
        setLocalName(value as string);

        return;
      }

      if (key === 'description') {
        setLocalDescription(value as string);

        return;
      }
    },
    [effectiveConfig]
  );

  const removeFromArray = useCallback(
    <K extends keyof NodeConfig>(key: K, itemToRemove: string) => {
      const currentArray = (effectiveConfig[key] as string[]) || [];
      const updatedArray = currentArray.filter((item) => item !== itemToRemove);

      setLocalConfig((prevConfig) => ({
        ...(prevConfig || effectiveConfig),
        [key]: updatedArray,
      }));
    },
    [effectiveConfig]
  );

  const addDataAssetFilter = useCallback(
    (dataAsset?: string) => {
      const existingDataAssets = effectiveConfig.dataAssetFilters.map(
        (df: DataAssetFilter) => df.dataAsset
      );
      const availableDataAssets = effectiveConfig.dataAssets.filter(
        (asset: string) => !existingDataAssets.includes(asset)
      );

      if (availableDataAssets.length === 0) {
        return;
      }

      const targetDataAsset =
        dataAsset && availableDataAssets.includes(dataAsset)
          ? dataAsset
          : availableDataAssets[0];

      const newId =
        effectiveConfig.dataAssetFilters.length > 0
          ? Math.max(
              ...effectiveConfig.dataAssetFilters.map(
                (df: DataAssetFilter) => df.id
              )
            ) + 1
          : 1;

      setLocalConfig((prevConfig) => ({
        ...(prevConfig || effectiveConfig),
        dataAssetFilters: [
          ...effectiveConfig.dataAssetFilters,
          {
            id: newId,
            dataAsset: targetDataAsset,
            filters: '',
          },
        ],
      }));
    },
    [effectiveConfig]
  );

  const updateDataAssetFilter = useCallback(
    (dataAssetId: number, value: string) => {
      const updatedFilters = effectiveConfig.dataAssetFilters.map(
        (df: DataAssetFilter) => {
          if (df.id === dataAssetId) {
            return {
              ...df,
              filters: value,
            };
          }

          return df;
        }
      );

      setLocalConfig((prevConfig) => ({
        ...(prevConfig || effectiveConfig),
        dataAssetFilters: updatedFilters,
      }));
    },
    [effectiveConfig]
  );

  const removeDataAssetFilter = useCallback(
    (filterId: number) => {
      const updatedFilters = effectiveConfig.dataAssetFilters.filter(
        (df: DataAssetFilter) => df.id !== filterId
      );

      setLocalConfig((prevConfig) => ({
        ...(prevConfig || effectiveConfig),
        dataAssetFilters: updatedFilters,
      }));
    },
    [effectiveConfig]
  );

  const handleEventTypeChange = useCallback(
    (event: { target: { value: string[] } }) => {
      const newEventTypes = event.target.value;
      updateConfig('eventType', newEventTypes);
    },
    [updateConfig]
  );

  useEffect(() => {
    setBackendConfig(getBackendConfig(node));
  }, [node?.id]);

  const updateWorkflowMetadata = useCallback(() => {
    const backendTriggerType = convertDisplayToBackendTriggerType(
      effectiveConfig.triggerType
    );

    if (onWorkflowMetadataUpdate) {
      onWorkflowMetadataUpdate({
        displayName: localName !== null ? localName : effectiveConfig.name,
        description:
          (localDescription !== null
            ? localDescription
            : effectiveConfig.description) ?? '',
        triggerType: backendTriggerType,
      });
    }
  }, [
    localName,
    localDescription,
    effectiveConfig.name,
    effectiveConfig.description,
    effectiveConfig.triggerType,
    onWorkflowMetadataUpdate,
  ]);

  const buildTriggerConfiguration = useCallback(() => {
    const isEventBased =
      effectiveConfig.triggerType === WorkflowType.EVENT_BASED;
    const isPeriodicBatch =
      effectiveConfig.triggerType === WorkflowType.PERIODIC_BATCH;

    let filterConfig = {};

    if (isEventBased) {
      const eventFilters = serializeEventBasedFilters(
        effectiveConfig.triggerFilter || '',
        effectiveConfig.dataAssets
      );
      if (Object.keys(eventFilters).length > 0) {
        filterConfig = { filter: eventFilters };
      }
    } else if (isPeriodicBatch) {
      const periodicFilters = serializePeriodicBatchFilters(
        effectiveConfig.dataAssetFilters
      );

      if (Object.keys(periodicFilters).length > 0) {
        filterConfig = { filters: periodicFilters };
      }
    }

    const finalConfig = {
      ...effectiveConfig,
      ...backendConfig,
      ...filterConfig,
    };

    return finalConfig;
  }, [effectiveConfig, backendConfig]);

  const buildTaskConfiguration = useCallback(() => {
    return {
      ...effectiveConfig,
      ...backendConfig,
      displayName: effectiveConfig.name,
      filters: serializeDataAssetFilters(effectiveConfig.dataAssetFilters),
    };
  }, [effectiveConfig, backendConfig]);

  const handleSave = useCallback(async () => {
    if (!node) {
      return;
    }

    try {
      setIsUpdating(true);
      const isTriggerNode = isStartNode(node);

      if (isTriggerNode && allowFullStartNodeConfiguration) {
        updateWorkflowMetadata();
      }

      const configToSave = isTriggerNode
        ? buildTriggerConfiguration()
        : buildTaskConfiguration();

      const configWithUserIndicators = {
        ...configToSave,
        lastSaved: new Date().toISOString(),
        userModified: true,
      };

      onSave(node.id, configWithUserIndicators);
      onClose();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
    }
  }, [
    node,
    updateWorkflowMetadata,
    buildTriggerConfiguration,
    buildTaskConfiguration,
    onSave,
    onClose,
    allowFullStartNodeConfiguration,
  ]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const isWorkflowConfigValid = useMemo(
    () => validateWorkflowConfig(effectiveConfig, isStartNode(node)),
    [effectiveConfig, node]
  );

  const renderFormContent = () => {
    if (!node || !isStartNode(node)) {
      return null;
    }

    return (
      <WorkflowConfigFormV1
        addDataAssetFilter={addDataAssetFilter}
        allowFullStartNodeConfiguration={allowFullStartNodeConfiguration}
        allowScheduledTrigger={allowScheduledTrigger}
        allowStartNodeFilterScheduleAndBatchEdit={
          allowStartNodeFilterScheduleAndBatchEdit
        }
        availableEventTypes={[...AVAILABLE_OPTIONS.EVENT_TYPES]}
        availableExcludeFields={availableExcludeFields}
        config={effectiveConfig}
        handleEventTypeChange={handleEventTypeChange}
        removeDataAssetFilter={removeDataAssetFilter}
        removeFromArray={removeFromArray}
        updateConfig={updateConfig}
        onUpdateDataAssetFilter={updateDataAssetFilter}
      />
    );
  };

  if (!node) {
    return null;
  }

  return (
    <SlideoutMenu
      className="tw:z-9999"
      data-testid="node-config-sidebar"
      isOpen={isOpen}
      width={640}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}>
      {({ close }) => (
        <>
          <SlideoutMenu.Header data-testid="node-config-header" onClose={close}>
            <Typography
              as="p"
              className="tw:m-0 tw:text-sm tw:font-semibold tw:text-primary"
              data-testid="node-config-title">
              {getNodeTitle(node)}
            </Typography>
          </SlideoutMenu.Header>
          <SlideoutMenu.Content data-testid="node-config-content">
            <Divider orientation="horizontal" />
            {renderFormContent()}
          </SlideoutMenu.Content>
          <SlideoutMenu.Footer className="tw:shadow-none tw:p-0">
            <FormActionButtons
              showSave
              isDisabled={!isWorkflowConfigValid}
              isLoading={isUpdating}
              showDelete={false}
              onCancel={handleCancel}
              onSave={handleSave}
            />
          </SlideoutMenu.Footer>
        </>
      )}
    </SlideoutMenu>
  );
};
