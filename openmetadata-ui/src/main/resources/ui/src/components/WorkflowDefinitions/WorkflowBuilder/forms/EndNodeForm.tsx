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

interface EndNodeFormProps {
  node: Node;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
}

export const EndNodeForm: React.FC<EndNodeFormProps> = ({
  node,
  onClose,
  onDelete,
  onSave,
}) => {
  const [displayName, setDisplayName] = useState('End');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (node?.data) {
      setDisplayName(node.data.displayName || node.data.label || 'End');
      setDescription(node.data.description || '');
    }
  }, [node]);

  const handleSave = () => {
    const config = createNodeConfig({
      description,
      displayName,
      subType: 'endEvent',
      type: 'endEvent',
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
    <div className="tw:flex tw:flex-col tw:h-full">
      <MetadataFormSection
        description={description}
        isStartNode={false}
        name={displayName}
        onDescriptionChange={setDescription}
        onNameChange={setDisplayName}
      />

      <div className="tw:flex-1" />

      <FormActionButtons
        showDelete
        isDisabled={!isValidString(displayName)}
        onCancel={handleCancel}
        onDelete={handleDeleteNode}
        onSave={handleSave}
      />
    </div>
  );
};
