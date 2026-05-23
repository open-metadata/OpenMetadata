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
import { EntityType } from '../../../../enums/entity.enum';
import { NodeSubType } from '../../../../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../../../../generated/governance/workflows/elements/nodeType';
import {
  createNodeConfig,
  isValidString,
} from '../../../../utils/WorkflowBuilderUtils';
import { SearchOutputType } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import {
  FormActionButtons,
  MetadataFormSection,
  QueryBuilderSection,
} from './';

interface CheckConditionFormProps {
  entityTypes: EntityType[];
  node: Node;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
}

export const CheckConditionForm: React.FC<CheckConditionFormProps> = ({
  entityTypes,
  node,
  onClose,
  onDelete,
  onSave,
}) => {
  const getInitialRules = () => {
    if (node?.data) {
      const nodeConfig = node.data.config || {};

      return nodeConfig.rules;
    }
  };

  const [displayName, setDisplayName] = useState(
    node?.data?.displayName || node?.data?.label || ''
  );
  const [description, setDescription] = useState(node?.data?.description || '');
  const [rules, setRules] = useState(getInitialRules);

  useEffect(() => {
    if (node?.data) {
      const nodeConfig = node.data.config || {};

      setDisplayName(node.data.displayName || node.data.label || '');
      setDescription(node.data.description || '');

      const existingRules = nodeConfig.rules;
      if (existingRules && existingRules.trim() !== '') {
        setRules(existingRules);
      }
    }
  }, [node]);

  const handleRulesChange = (query: string) => {
    setRules(query);
  };

  const handleSave = () => {
    const config = createNodeConfig({
      config: {
        rules: rules,
      },
      description,
      displayName,
      subType: NodeSubType.CheckEntityAttributesTask,
      type: NodeType.AutomatedTask,
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

        <QueryBuilderSection
          entityTypes={entityTypes[0] || EntityType.ALL}
          label="Rules to Check"
          outputType={SearchOutputType.JSONLogic}
          value={rules}
          onChange={handleRulesChange}
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
