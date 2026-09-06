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

import { Select } from '@openmetadata/ui-core-components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import {
  createNodeConfig,
  isValidString,
} from '../../../../utils/WorkflowBuilderUtils';
import { FormActionButtons, MetadataFormSection } from './';

interface ResolvePendingChangeFormProps {
  node: Node;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
}

const ACTION_OPTIONS = ['commit', 'discard', 'hold'] as const;

export const ResolvePendingChangeForm: React.FC<
  ResolvePendingChangeFormProps
> = ({ node, onClose, onDelete, onSave }) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [action, setAction] = useState('');

  useEffect(() => {
    if (node?.data) {
      setDisplayName(node.data.displayName || node.data.label || '');
      setDescription(node.data.description || '');
      setAction(node.data.config?.action || '');
    }
  }, [node]);

  const actionLabels: Record<string, string> = {
    commit: t('label.commit'),
    discard: t('label.discard'),
    hold: t('label.hold'),
  };

  const handleSave = () => {
    const config = createNodeConfig({
      config: { action },
      description,
      displayName,
      subType: 'resolvePendingChangeTask',
      type: 'automatedTask',
    });

    onSave(node.id, config);
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

        <div className="tw:mb-6">
          <Select
            data-testid="resolve-action-select"
            isDisabled={isFormDisabled}
            label={t('label.action')}
            value={action}
            onChange={(value) => setAction(String(value ?? ''))}>
            {ACTION_OPTIONS.map((option) => (
              <Select.Item
                id={option}
                key={option}
                label={actionLabels[option]}
              />
            ))}
          </Select>
        </div>
      </div>

      <FormActionButtons
        showDelete
        isDisabled={!isValidString(displayName) || !isValidString(action)}
        onCancel={onClose}
        onDelete={handleDeleteNode}
        onSave={handleSave}
      />
    </>
  );
};
