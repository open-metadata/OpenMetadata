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
  Checkbox,
  Input,
  PasswordInput,
  Select,
} from '@openmetadata/ui-core-components';
import { omit } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import { MASKED_PASSWORD_VALUE } from '../../../../constants/Secrets.constants';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { CommitSigningKey } from '../../../../generated/governance/workflows/elements/nodes/automatedTask/sinkConfig/gitSinkConfig';
import { SinkType } from '../../../../generated/governance/workflows/elements/nodes/automatedTask/sinkTask';
import {
  createNodeConfig,
  isValidString,
} from '../../../../utils/WorkflowBuilderUtils';

import { FormActionButtons } from './FormActionButtons';
import { MetadataFormSection } from './MetadataFormSection';

interface SinkTaskFormProps {
  node: Node;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
}

interface SinkNodeConfig {
  repositoryUrl?: string;
  branch?: string;
  basePath?: string;
  credentials?: { type?: string; token?: string };
  conflictResolution?: string;
  commitConfig?: {
    messageTemplate?: string;
    authorName?: string;
    authorEmail?: string;
  };
  signingKey?: CommitSigningKey;
  allowUnsignedFastPush?: boolean;
}

interface SinkTaskConfig {
  sinkType?: SinkType;
  outputFormat?: string;
  sinkConfig?: SinkNodeConfig;
}

interface SinkNodeData {
  displayName?: string;
  label?: string;
  description?: string;
  config?: SinkTaskConfig;
}

interface SinkFormData {
  displayName: string;
  description: string;
  repositoryUrl: string;
  branch: string;
  basePath: string;
  token: string;
  conflictResolution: string;
  commitMessageTemplate: string;
  authorName: string;
  authorEmail: string;
  signingPrivateKey: string;
  signingPassphrase: string;
  allowUnsignedFastPush: boolean;
}

type SinkFormTextField = {
  [K in keyof SinkFormData]: SinkFormData[K] extends string ? K : never;
}[keyof SinkFormData];

const buildSinkConnectionValues = (sinkConfig: SinkNodeConfig) => ({
  repositoryUrl: sinkConfig.repositoryUrl || '',
  branch: sinkConfig.branch || 'main',
  basePath: sinkConfig.basePath || 'metadata',
  token: sinkConfig.credentials?.token || '',
  conflictResolution: sinkConfig.conflictResolution || 'overwriteExternal',
  signingPrivateKey: sinkConfig.signingKey?.privateKey || '',
  signingPassphrase: sinkConfig.signingKey?.passphrase || '',
  allowUnsignedFastPush: sinkConfig.allowUnsignedFastPush ?? false,
});

const buildSinkMetaValues = (
  data: SinkNodeData,
  sinkConfig: SinkNodeConfig,
  t: ReturnType<typeof useTranslation>['t']
) => ({
  displayName: data.displayName || data.label || '',
  description: data.description || '',
  commitMessageTemplate:
    sinkConfig.commitConfig?.messageTemplate ||
    'Sync {entityType}: {entityName}',
  authorName: sinkConfig.commitConfig?.authorName || t('label.brand-name-bot'),
  authorEmail: sinkConfig.commitConfig?.authorEmail || 'bot@openmetadata.org',
});

const buildSigningKey = (
  formData: SinkFormData
): CommitSigningKey | undefined => {
  let signingKey: CommitSigningKey | undefined;
  if (formData.signingPrivateKey) {
    signingKey = { privateKey: formData.signingPrivateKey };
    if (formData.signingPassphrase) {
      signingKey.passphrase = formData.signingPassphrase;
    }
  }

  return signingKey;
};

// Fields the form does not render (apiBaseUrl, retryConfig, timeout, ...) come
// from the stored config, so saving the node does not drop them. signingKey and
// allowUnsignedFastPush are rebuilt from the form: an empty key or an unchecked
// box leaves the field out rather than sending an empty or default value.
const buildSinkConfig = (
  storedSinkConfig: SinkNodeConfig,
  formData: SinkFormData
): SinkNodeConfig => {
  const signingKey = buildSigningKey(formData);

  return {
    ...omit(storedSinkConfig, ['signingKey', 'allowUnsignedFastPush']),
    repositoryUrl: formData.repositoryUrl,
    branch: formData.branch,
    basePath: formData.basePath,
    credentials: {
      ...storedSinkConfig.credentials,
      type: 'token',
      token: formData.token,
    },
    conflictResolution: formData.conflictResolution,
    commitConfig: {
      ...storedSinkConfig.commitConfig,
      messageTemplate: formData.commitMessageTemplate,
      authorName: formData.authorName,
      authorEmail: formData.authorEmail,
    },
    ...(signingKey && { signingKey }),
    ...(formData.allowUnsignedFastPush && { allowUnsignedFastPush: true }),
  };
};

const countEdgeMaskChars = (value: string, edge: RegExp, limit: number) =>
  Math.min(value.length - value.replace(edge, '').length, limit);

// A masked secret is a placeholder, not secret text: the first edit replaces it
// rather than adding to it. The edit keeps the mask characters on either side of
// the cursor, so the text between them is what the user typed or pasted, '*'
// included. Deleting a mask character leaves only mask, so the field clears.
const replaceMask = (prevValue: string, value: string): string => {
  let result = value;
  if (prevValue === MASKED_PASSWORD_VALUE) {
    const maskLength = MASKED_PASSWORD_VALUE.length;
    const before = countEdgeMaskChars(value, /^\*+/, maskLength);
    const rest = value.slice(before);
    const after = countEdgeMaskChars(rest, /\*+$/, maskLength - before);
    result = rest.slice(0, rest.length - after);
  }

  return result;
};

// A masked passphrase belongs to the replaced key, so it is reset too.
const applyPrivateKeyChange = (
  prev: SinkFormData,
  value: string
): SinkFormData => {
  const resetsPassphrase =
    prev.signingPrivateKey === MASKED_PASSWORD_VALUE &&
    prev.signingPassphrase === MASKED_PASSWORD_VALUE;

  return {
    ...prev,
    signingPrivateKey: replaceMask(prev.signingPrivateKey, value),
    signingPassphrase: resetsPassphrase ? '' : prev.signingPassphrase,
  };
};

const applySecretChange = (
  prev: SinkFormData,
  field: 'token' | 'signingPassphrase',
  value: string
): SinkFormData => ({ ...prev, [field]: replaceMask(prev[field], value) });

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

  const [formData, setFormData] = useState<SinkFormData>({
    displayName: '',
    description: '',
    repositoryUrl: '',
    branch: 'main',
    basePath: 'metadata',
    token: '',
    conflictResolution: 'overwriteExternal',
    commitMessageTemplate: 'Sync {entityType}: {entityName}',
    authorName: t('label.brand-name-bot'),
    authorEmail: 'bot@openmetadata.org',
    signingPrivateKey: '',
    signingPassphrase: '',
    allowUnsignedFastPush: false,
  });

  const updateFormData = useCallback(
    (field: SinkFormTextField, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handlePrivateKeyChange = useCallback((value: string) => {
    setFormData((prev) => applyPrivateKeyChange(prev, value));
  }, []);

  const handleTokenChange = useCallback((value: string) => {
    setFormData((prev) => applySecretChange(prev, 'token', value));
  }, []);

  const handlePassphraseChange = useCallback((value: string) => {
    setFormData((prev) => applySecretChange(prev, 'signingPassphrase', value));
  }, []);

  const handleAllowUnsignedFastPushChange = useCallback((value: boolean) => {
    setFormData((prev) => ({ ...prev, allowUnsignedFastPush: value }));
  }, []);

  const isSigningKeyConfigured =
    formData.signingPrivateKey === MASKED_PASSWORD_VALUE;

  useEffect(() => {
    if (node?.data) {
      const data = node.data as SinkNodeData;
      const sinkConfig = data.config?.sinkConfig ?? {};

      setFormData({
        ...buildSinkMetaValues(data, sinkConfig, t),
        ...buildSinkConnectionValues(sinkConfig),
      });
    }
  }, [node]);

  const handleSave = () => {
    const storedConfig = (node.data as SinkNodeData)?.config ?? {};
    // Saving writes a git sink, so only a stored git sinkConfig is carried over;
    // another sink type's fields and masked secrets are not valid git config.
    const storedGitSinkConfig =
      storedConfig.sinkType === SinkType.Git
        ? storedConfig.sinkConfig ?? {}
        : {};

    // The node's config is replaced as a whole on save, so the task-level
    // fields this form does not render (batchMode, syncMode, entityFilter, ...)
    // are carried over from the stored config.
    const config = createNodeConfig({
      displayName: formData.displayName,
      description: formData.description,
      type: 'automatedTask',
      subType: 'sinkTask',
      config: {
        ...storedConfig,
        sinkType: SinkType.Git,
        outputFormat: storedConfig.outputFormat ?? 'yaml',
        sinkConfig: buildSinkConfig(storedGitSinkConfig, formData),
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
            onChange={handleTokenChange}
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

        <div className="tw:mt-5">
          <PasswordInput
            multiline
            data-testid="signing-private-key-input"
            hint={
              <>
                <span className="tw:block">
                  {t('message.git-sink-signing-key-hint')}
                </span>
                {isSigningKeyConfigured && (
                  <span className="tw:block">
                    {t('message.git-sink-signing-key-configured')}
                  </span>
                )}
              </>
            }
            isDisabled={isFormDisabled}
            label={t('label.signing-private-key')}
            rows={4}
            value={formData.signingPrivateKey}
            onChange={handlePrivateKeyChange}
          />
        </div>

        <div className="tw:mt-5">
          <Input
            data-testid="signing-passphrase-input"
            isDisabled={isFormDisabled || !formData.signingPrivateKey}
            label={t('label.passphrase')}
            type="password"
            value={formData.signingPassphrase}
            onChange={handlePassphraseChange}
          />
        </div>

        <div className="tw:mt-5">
          <Checkbox
            data-testid="allow-unsigned-fast-push-checkbox"
            hint={t('message.git-sink-unsigned-fast-push-hint')}
            isDisabled={isFormDisabled}
            isSelected={formData.allowUnsignedFastPush}
            label={t('label.allow-unsigned-fast-push')}
            onChange={handleAllowUnsignedFastPushChange}
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
