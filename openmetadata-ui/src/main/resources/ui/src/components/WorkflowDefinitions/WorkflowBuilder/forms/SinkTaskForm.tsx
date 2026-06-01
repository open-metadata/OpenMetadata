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

import { Input, Select } from '@openmetadata/ui-core-components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import {
  createNodeConfig,
  isValidString,
} from '../../../../utils/WorkflowBuilderUtils';

import { FormActionButtons, MetadataFormSection } from './';

interface SinkTaskFormProps {
  node: Node;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
}

export const SinkTaskForm: React.FC<SinkTaskFormProps> = ({
  node,
  onSave,
  onClose,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();

  const conflictResolutionOptions = useMemo(
    () => [
      { label: t('message.select-conflict-resolution'), value: '' },
      {
        label: t('label.overwrite-external-changes'),
        value: 'overwriteExternal',
      },
      {
        label: t('label.preserve-external-changes'),
        value: 'preserveExternal',
      },
      { label: t('label.fail-on-conflict'), value: 'fail' },
    ],
    [t]
  );

  const [formData, setFormData] = useState({
    displayName: '',
    description: '',
    repositoryUrl: '',
    branch: 'main',
    basePath: 'metadata',
    token: '',
    conflictResolution: 'overwriteExternal',
    commitMessageTemplate: 'Sync {entityType}: {entityName}',
    authorName: 'OpenMetadata Bot',
    authorEmail: 'bot@openmetadata.org',
  });

  const updateFormData = useCallback(
    (field: keyof typeof formData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  useEffect(() => {
    if (node?.data) {
      const nodeConfig = node.data.config || {};
      const sinkConfig = nodeConfig.sinkConfig || {};

      setFormData({
        displayName: node.data.displayName || node.data.label || '',
        description: node.data.description || '',
        repositoryUrl: sinkConfig.repositoryUrl || '',
        branch: sinkConfig.branch || 'main',
        basePath: sinkConfig.basePath || 'metadata',
        token: sinkConfig.credentials?.token || '',
        conflictResolution:
          sinkConfig.conflictResolution || 'overwriteExternal',
        commitMessageTemplate:
          sinkConfig.commitConfig?.messageTemplate ||
          'Sync {entityType}: {entityName}',
        authorName: sinkConfig.commitConfig?.authorName || 'OpenMetadata Bot',
        authorEmail:
          sinkConfig.commitConfig?.authorEmail || 'bot@openmetadata.org',
      });
    }
  }, [node]);

  const handleSave = () => {
    const sinkConfig = {
      repositoryUrl: formData.repositoryUrl,
      branch: formData.branch,
      basePath: formData.basePath,
      credentials: {
        type: 'token',
        token: formData.token,
      },
      conflictResolution: formData.conflictResolution,
      commitConfig: {
        messageTemplate: formData.commitMessageTemplate,
        authorName: formData.authorName,
        authorEmail: formData.authorEmail,
      },
    };

    const config = createNodeConfig({
      displayName: formData.displayName,
      description: formData.description,
      type: 'automatedTask',
      subType: 'sinkTask',
      config: {
        sinkType: 'git',
        outputFormat: 'yaml',
        sinkConfig,
      },
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

  const isFormValid = () => {
    if (!isValidString(formData.displayName)) {
      return false;
    }

    if (!isValidString(formData.repositoryUrl)) {
      return false;
    }

    return isValidString(formData.token);
  };

  return (
    <>
      <div className="tw:flex-1 tw:flex tw:flex-col">
        <MetadataFormSection
          description={formData.description}
          isStartNode={false}
          name={formData.displayName}
          onDescriptionChange={(value) => updateFormData('description', value)}
          onNameChange={(value) => updateFormData('displayName', value)}
        />

        <div className="tw:mt-5">
          <Input
            isRequired
            data-testid="repository-url-input"
            isDisabled={isFormDisabled}
            label={t('label.repository-url')}
            placeholder="https://github.com/org/repo.git"
            value={formData.repositoryUrl}
            onChange={(value) => updateFormData('repositoryUrl', value)}
          />
        </div>

        <div className="tw:mt-5">
          <Input
            data-testid="branch-input"
            isDisabled={isFormDisabled}
            label={t('label.branch')}
            placeholder="main"
            value={formData.branch}
            onChange={(value) => updateFormData('branch', value)}
          />
        </div>

        <div className="tw:mt-5">
          <Input
            data-testid="base-path-input"
            isDisabled={isFormDisabled}
            label={t('label.base-path')}
            placeholder="metadata"
            value={formData.basePath}
            onChange={(value) => updateFormData('basePath', value)}
          />
        </div>

        <div className="tw:mt-5">
          <Input
            isRequired
            data-testid="token-input"
            isDisabled={isFormDisabled}
            label={t('label.access-token')}
            placeholder="ghp_xxxxxxxxxxxx"
            type="password"
            value={formData.token}
            onChange={(value) => updateFormData('token', value)}
          />
        </div>

        <div className="tw:mt-5">
          <Select
            data-testid="conflict-resolution-select"
            isDisabled={isFormDisabled}
            label={t('label.conflict-resolution')}
            value={formData.conflictResolution}
            onChange={(key) =>
              updateFormData('conflictResolution', String(key ?? ''))
            }>
            {conflictResolutionOptions.map((opt) => (
              <Select.Item id={opt.value} key={opt.value} label={opt.label} />
            ))}
          </Select>
        </div>

        <div className="tw:mt-5">
          <Input
            data-testid="commit-message-input"
            isDisabled={isFormDisabled}
            label={t('label.commit-message-template')}
            placeholder="Sync {entityType}: {entityName}"
            value={formData.commitMessageTemplate}
            onChange={(value) => updateFormData('commitMessageTemplate', value)}
          />
        </div>
      </div>

      <FormActionButtons
        showDelete
        isDisabled={!isFormValid()}
        onCancel={onClose}
        onDelete={handleDeleteNode}
        onSave={handleSave}
      />
    </>
  );
};
