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

import React, { useEffect, useState } from 'react';
import { Node } from 'reactflow';
import {
  createNodeConfig,
  isValidString,
} from '../../../../utils/WorkflowBuilderUtils';
import { FormActionButtons, MetadataFormSection } from './';
import type { CheckChangeDescConditionPayload } from './ConditionBuilder';
import {
  buildConditionBuilderPayload,
  ConditionBuilder,
  parseConditionBuilderPayload,
} from './ConditionBuilder';

interface CheckChangeDescriptionFormProps {
  node: Node;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
}

export const CheckChangeDescriptionForm: React.FC<
  CheckChangeDescriptionFormProps
> = ({ node, onSave, onClose, onDelete }) => {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [conditionPayload, setConditionPayload] =
    useState<CheckChangeDescConditionPayload | null>(null);

  useEffect(() => {
    if (!node?.data) {
      return;
    }
    setDisplayName(node.data.displayName || node.data.label || '');
    setDescription(node.data.description || '');
    const cfg = node.data.config;
    if (
      cfg &&
      typeof cfg === 'object' &&
      (cfg.rules || (cfg as { include?: unknown }).include)
    ) {
      setConditionPayload({ config: cfg });
    } else {
      setConditionPayload(null);
    }
  }, [node]);

  const handleSave = () => {
    let configPayload = conditionPayload?.config;
    const hasLegacyInclude = (configPayload as { include?: unknown })?.include;
    const hasRulesObject =
      configPayload?.rules &&
      typeof configPayload.rules === 'object' &&
      !Array.isArray(configPayload.rules);
    if (configPayload && (hasLegacyInclude || hasRulesObject)) {
      const parsed = parseConditionBuilderPayload({ config: configPayload });
      configPayload = buildConditionBuilderPayload(
        parsed.condition,
        parsed.rows
      ).config;
    }
    const config = createNodeConfig({
      displayName,
      description,
      type: 'automatedTask',
      subType: 'checkChangeDescriptionTask',
      ...(configPayload && {
        config: {
          condition: configPayload.condition,
          rules: configPayload.rules ?? {},
        },
      }),
    });
    onSave(node.id, config);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleDeleteNode = () => {
    if (onDelete) {
      onDelete(node.id);
    }
    onClose();
  };

  return (
    <>
      <div className="tw:flex-1 tw:flex tw:flex-col">
        <MetadataFormSection
          description={description}
          isStartNode={false}
          name={displayName}
          onDescriptionChange={setDescription}
          onNameChange={setDisplayName}
        />

        <ConditionBuilder
          showCondition
          data-testid="check-change-desc-condition-builder"
          value={conditionPayload}
          onChange={setConditionPayload}
        />
      </div>

      <FormActionButtons
        showDelete
        isDisabled={!isValidString(displayName)}
        onCancel={handleCancel}
        onDelete={handleDeleteNode}
        onSave={handleSave}
      />
    </>
  );
};
