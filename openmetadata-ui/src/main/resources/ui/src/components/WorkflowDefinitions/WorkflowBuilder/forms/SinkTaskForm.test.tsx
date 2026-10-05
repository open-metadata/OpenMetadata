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

import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { Node } from 'reactflow';
import { MASKED_PASSWORD_VALUE } from '../../../../constants/Secrets.constants';
import { WorkflowModeProvider } from '../../../../contexts/WorkflowModeContext';
import { SinkTaskForm } from './SinkTaskForm';

const getInputByTestId = (testId: string): HTMLInputElement => {
  const wrapper = screen.getByTestId(testId);

  return within(wrapper).getByRole('textbox') as HTMLInputElement;
};

jest.mock('@openmetadata/ui-core-components', () => {
  const Input = (props: {
    value?: string;
    onChange?: (value: string) => void;
    label?: string;
    'data-testid'?: string;
    isRequired?: boolean;
    type?: string;
    isDisabled?: boolean;
  }) => {
    const {
      value = '',
      onChange,
      label,
      'data-testid': dataTestId,
      isRequired,
      type = 'text',
      isDisabled,
    } = props;

    return (
      <div data-testid={dataTestId}>
        {label && (
          <>
            {/* eslint-disable-next-line jsx-a11y/label-has-for -- test mock; input below is named via aria-label */}
            <label>{label}</label>
            {isRequired && <span> *</span>}
          </>
        )}
        <input
          aria-label={label}
          disabled={isDisabled}
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    );
  };

  const SelectItem = (props: { id: string; label?: string }) => (
    <option value={props.id}>{props.label}</option>
  );

  const Select = (props: {
    value?: string;
    onChange?: (key: string) => void;
    children?: React.ReactNode;
    label?: string;
    'data-testid'?: string;
    isDisabled?: boolean;
  }) => {
    const {
      value = '',
      onChange,
      children,
      label,
      'data-testid': dataTestId,
    } = props;

    return (
      <div>
        {/* eslint-disable-next-line jsx-a11y/label-has-for -- test mock; select below is named via aria-label */}
        {label != null && <label>{label}</label>}
        <select
          aria-label={label}
          data-testid={dataTestId}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}>
          {children}
        </select>
      </div>
    );
  };

  const SelectWithItem = Object.assign(Select, { Item: SelectItem });

  const PasswordInput = (props: {
    value?: string;
    onChange?: (value: string) => void;
    label?: string;
    hint?: React.ReactNode;
    'data-testid'?: string;
    isDisabled?: boolean;
  }) => {
    const {
      value = '',
      onChange,
      label,
      hint,
      'data-testid': dataTestId,
      isDisabled,
    } = props;

    return (
      <div data-testid={dataTestId}>
        <textarea
          aria-label={label}
          disabled={isDisabled}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
        <div>{hint}</div>
      </div>
    );
  };

  const Checkbox = (props: {
    isSelected?: boolean;
    onChange?: (value: boolean) => void;
    label?: string;
    hint?: string;
    'data-testid'?: string;
    isDisabled?: boolean;
  }) => (
    <div>
      <input
        aria-label={props.label}
        checked={props.isSelected ?? false}
        data-testid={props['data-testid']}
        disabled={props.isDisabled}
        type="checkbox"
        onChange={(e) => props.onChange?.(e.target.checked)}
      />
      <span>{props.hint}</span>
    </div>
  );

  return { Checkbox, Input, PasswordInput, Select: SelectWithItem };
});

jest.mock('../../../../contexts/WorkflowModeContext', () => ({
  WorkflowModeProvider: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="workflow-mode-provider">{children}</div>
    )),
  useWorkflowModeContext: jest.fn(() => ({
    mode: 'edit',
    isEditMode: true,
    isViewMode: false,
    toggleMode: jest.fn(),
    setMode: jest.fn(),
  })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('./MetadataFormSection', () => ({
  MetadataFormSection: jest.fn().mockImplementation(({ name, description }) => (
    <div data-testid="metadata-form-section">
      <input
        aria-label="Display Name"
        data-testid="display-name-input"
        defaultValue={name}
        placeholder="Display Name"
      />
      <input
        aria-label="Description"
        data-testid="description-input"
        defaultValue={description}
        placeholder="Description"
      />
    </div>
  )),
}));

jest.mock('./FormActionButtons', () => ({
  FormActionButtons: jest
    .fn()
    .mockImplementation(({ onSave, onCancel, onDelete, isDisabled }) => (
      <div data-testid="form-action-buttons">
        <button
          data-testid="save-button"
          disabled={isDisabled}
          onClick={onSave}>
          Save
        </button>
        <button data-testid="cancel-button" onClick={onCancel}>
          Cancel
        </button>
        <button data-testid="delete-button" onClick={onDelete}>
          Delete
        </button>
      </div>
    )),
}));

const createMockNode = (overrides?: Partial<Node>): Node => ({
  id: 'test-node-1',
  type: 'sinkTask',
  position: { x: 0, y: 0 },
  data: {
    label: 'Git Sink',
    displayName: '',
    description: '',
    config: {},
  },
  ...overrides,
});

const createMockNodeWithConfig = (): Node => ({
  id: 'test-node-2',
  type: 'sinkTask',
  position: { x: 0, y: 0 },
  data: {
    label: 'Configured Git Sink',
    displayName: 'My Git Sink',
    description: 'Syncs metadata to GitHub',
    config: {
      sinkConfig: {
        repositoryUrl: 'https://github.com/test-org/test-repo.git',
        branch: 'develop',
        basePath: 'custom/path',
        credentials: {
          type: 'token',
          token: 'ghp_test123',
        },
        conflictResolution: 'preserveExternal',
        commitConfig: {
          messageTemplate: 'Custom: {entityType} - {entityName}',
          authorName: 'Custom Bot',
          authorEmail: 'custom@example.com',
        },
      },
    },
  },
});

const createMockNodeWithSigningConfig = (): Node => ({
  id: 'test-node-3',
  type: 'sinkTask',
  position: { x: 0, y: 0 },
  data: {
    label: 'Signed Git Sink',
    displayName: 'Signed Sink',
    description: '',
    config: {
      sinkType: 'git',
      outputFormat: 'json',
      batchMode: true,
      syncMode: 'overwrite',
      sinkConfig: {
        repositoryUrl: 'https://github.com/test-org/test-repo.git',
        branch: 'main',
        basePath: 'metadata',
        apiBaseUrl: 'https://github.mycompany.com/api',
        timeout: 120,
        retryConfig: { maxRetries: 5 },
        syncMetadata: { embed: true },
        credentials: { type: 'token', token: MASKED_PASSWORD_VALUE },
        conflictResolution: 'overwriteExternal',
        signingKey: {
          privateKey: MASKED_PASSWORD_VALUE,
          passphrase: MASKED_PASSWORD_VALUE,
        },
      },
    },
  },
});

const createMockWebhookNode = (): Node => ({
  id: 'test-node-4',
  type: 'sinkTask',
  position: { x: 0, y: 0 },
  data: {
    label: 'Webhook Sink',
    displayName: 'Webhook Sink',
    description: '',
    config: {
      sinkType: 'webhook',
      outputFormat: 'json',
      batchMode: false,
      sinkConfig: {
        endpoint: 'https://hooks.example.com/metadata',
        httpMethod: 'POST',
        headers: { 'X-Api-Key': MASKED_PASSWORD_VALUE },
        authentication: { type: 'bearer', token: MASKED_PASSWORD_VALUE },
        retryConfig: { maxRetries: 2 },
        timeout: 15,
      },
    },
  },
});

const ARMORED_KEY = [
  '-----BEGIN PGP PRIVATE KEY BLOCK-----',
  'lQVYBGZexample',
  '-----END PGP PRIVATE KEY BLOCK-----',
].join('\n');

const getPrivateKeyInput = (): HTMLTextAreaElement =>
  within(screen.getByTestId('signing-private-key-input')).getByRole(
    'textbox'
  ) as HTMLTextAreaElement;

const getPassphraseInput = (): HTMLInputElement =>
  screen
    .getByTestId('signing-passphrase-input')
    .querySelector('input') as HTMLInputElement;

const getTokenInput = (): HTMLInputElement =>
  screen.getByTestId('token-input').querySelector('input') as HTMLInputElement;

const mockOnSave = jest.fn();
const mockOnClose = jest.fn();
const mockOnDelete = jest.fn();

const getSavedConfig = () =>
  mockOnSave.mock.calls[0][1] as {
    config: Record<string, unknown> & { sinkConfig: Record<string, unknown> };
  };

const defaultProps = {
  node: createMockNode(),
  onSave: mockOnSave,
  onClose: mockOnClose,
  onDelete: mockOnDelete,
};

const renderWithProvider = (
  props: Partial<typeof defaultProps> &
    Pick<typeof defaultProps, 'node'> = defaultProps
) => {
  return render(
    <WorkflowModeProvider>
      <SinkTaskForm {...defaultProps} {...props} />
    </WorkflowModeProvider>
  );
};

describe('SinkTaskForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all form fields', () => {
      renderWithProvider();

      expect(screen.getByTestId('metadata-form-section')).toBeInTheDocument();
      expect(screen.getByTestId('repository-url-input')).toBeInTheDocument();
      expect(screen.getByTestId('branch-input')).toBeInTheDocument();
      expect(screen.getByTestId('base-path-input')).toBeInTheDocument();
      expect(screen.getByTestId('token-input')).toBeInTheDocument();
      expect(
        screen.getByTestId('conflict-resolution-select')
      ).toBeInTheDocument();
      expect(screen.getByTestId('commit-message-input')).toBeInTheDocument();
    });

    it('should render labels with translation keys', () => {
      renderWithProvider();

      expect(screen.getByText('label.repository-url')).toBeInTheDocument();
      expect(screen.getByText('label.branch')).toBeInTheDocument();
      expect(screen.getByText('label.base-path')).toBeInTheDocument();
      expect(screen.getByText('label.access-token')).toBeInTheDocument();
      expect(screen.getByText('label.conflict-resolution')).toBeInTheDocument();
      expect(
        screen.getByText('label.commit-message-template')
      ).toBeInTheDocument();
    });

    it('should display required asterisks for repository URL and token', () => {
      renderWithProvider();

      const repoLabel = screen.getByText('label.repository-url').parentElement;
      const tokenLabel = screen.getByText('label.access-token').parentElement;

      expect(repoLabel).toHaveTextContent('*');
      expect(tokenLabel).toHaveTextContent('*');
    });

    it('should render form action buttons', () => {
      renderWithProvider();

      expect(screen.getByTestId('form-action-buttons')).toBeInTheDocument();
      expect(screen.getByTestId('save-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
      expect(screen.getByTestId('delete-button')).toBeInTheDocument();
    });
  });

  describe('Default Values', () => {
    it('should have default branch value of "main"', () => {
      renderWithProvider();

      const branchInput = getInputByTestId('branch-input');

      expect(branchInput).toHaveValue('main');
    });

    it('should have default base path value of "metadata"', () => {
      renderWithProvider();

      const basePathInput = getInputByTestId('base-path-input');

      expect(basePathInput).toHaveValue('metadata');
    });

    it('should have default conflict resolution of "overwriteExternal"', () => {
      renderWithProvider();

      const conflictSelect = screen.getByTestId('conflict-resolution-select');

      expect(conflictSelect).toHaveValue('overwriteExternal');
    });

    it('should have default commit message template', () => {
      renderWithProvider();

      const commitInput = getInputByTestId('commit-message-input');

      expect(commitInput).toHaveValue('Sync {entityType}: {entityName}');
    });
  });

  describe('Populating from Node Data', () => {
    it('should populate form from existing node config', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithConfig(),
      });

      expect(getInputByTestId('repository-url-input')).toHaveValue(
        'https://github.com/test-org/test-repo.git'
      );
      expect(getInputByTestId('branch-input')).toHaveValue('develop');
      expect(getInputByTestId('base-path-input')).toHaveValue('custom/path');
      expect(
        within(screen.getByTestId('token-input')).getByDisplayValue(
          'ghp_test123'
        )
      ).toBeInTheDocument();
      expect(screen.getByTestId('conflict-resolution-select')).toHaveValue(
        'preserveExternal'
      );
      expect(getInputByTestId('commit-message-input')).toHaveValue(
        'Custom: {entityType} - {entityName}'
      );
    });
  });

  describe('Form Validation', () => {
    it('should disable save button when repository URL is empty', () => {
      renderWithProvider();

      const tokenWrapper = screen.getByTestId('token-input');
      const tokenInput = tokenWrapper.querySelector(
        'input'
      ) as HTMLInputElement;
      fireEvent.change(tokenInput, { target: { value: 'ghp_test' } });

      const saveButton = screen.getByTestId('save-button');

      expect(saveButton).toBeDisabled();
    });

    it('should disable save button when token is empty', () => {
      renderWithProvider();

      const repoInput = getInputByTestId('repository-url-input');
      fireEvent.change(repoInput, {
        target: { value: 'https://github.com/org/repo.git' },
      });

      const saveButton = screen.getByTestId('save-button');

      expect(saveButton).toBeDisabled();
    });

    it('should enable save button when all required fields are filled', async () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithConfig(),
      });

      const saveButton = screen.getByTestId('save-button');

      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Form Interactions', () => {
    it('should update repository URL on input change', () => {
      renderWithProvider();

      const repoInput = getInputByTestId('repository-url-input');
      fireEvent.change(repoInput, {
        target: { value: 'https://github.com/my-org/my-repo.git' },
      });

      expect(repoInput).toHaveValue('https://github.com/my-org/my-repo.git');
    });

    it('should update branch on input change', () => {
      renderWithProvider();

      const branchInput = getInputByTestId('branch-input');
      fireEvent.change(branchInput, { target: { value: 'feature-branch' } });

      expect(branchInput).toHaveValue('feature-branch');
    });

    it('should update base path on input change', () => {
      renderWithProvider();

      const basePathInput = getInputByTestId('base-path-input');
      fireEvent.change(basePathInput, {
        target: { value: 'custom/metadata/path' },
      });

      expect(basePathInput).toHaveValue('custom/metadata/path');
    });

    it('should update token on input change', () => {
      renderWithProvider();

      const tokenWrapper = screen.getByTestId('token-input');
      const tokenInput = tokenWrapper.querySelector(
        'input'
      ) as HTMLInputElement;
      fireEvent.change(tokenInput, {
        target: { value: 'ghp_secrettoken123' },
      });

      expect(tokenInput).toHaveValue('ghp_secrettoken123');
    });

    it('should update conflict resolution on select change', () => {
      renderWithProvider();

      const conflictSelect = screen.getByTestId('conflict-resolution-select');
      fireEvent.change(conflictSelect, { target: { value: 'fail' } });

      expect(conflictSelect).toHaveValue('fail');
    });

    it('should update commit message template on input change', () => {
      renderWithProvider();

      const commitInput = getInputByTestId('commit-message-input');
      fireEvent.change(commitInput, { target: { value: 'Export: {fqn}' } });

      expect(commitInput).toHaveValue('Export: {fqn}');
    });
  });

  describe('Save Functionality', () => {
    it('should call onSave with correct config when save is clicked', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithConfig(),
      });

      const saveButton = screen.getByTestId('save-button');
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockOnSave).toHaveBeenCalledWith(
        'test-node-2',
        expect.objectContaining({
          displayName: 'My Git Sink',
          description: 'Syncs metadata to GitHub',
          type: 'automatedTask',
          subType: 'sinkTask',
          config: expect.objectContaining({
            sinkType: 'git',
            outputFormat: 'yaml',
            sinkConfig: expect.objectContaining({
              repositoryUrl: 'https://github.com/test-org/test-repo.git',
              branch: 'develop',
              basePath: 'custom/path',
              credentials: {
                type: 'token',
                token: 'ghp_test123',
              },
              conflictResolution: 'preserveExternal',
              commitConfig: expect.objectContaining({
                messageTemplate: 'Custom: {entityType} - {entityName}',
              }),
            }),
          }),
        })
      );
    });

    it('should call onClose after successful save', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithConfig(),
      });

      const saveButton = screen.getByTestId('save-button');
      fireEvent.click(saveButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cancel Functionality', () => {
    it('should call onClose when cancel is clicked', () => {
      renderWithProvider();

      const cancelButton = screen.getByTestId('cancel-button');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onSave when cancel is clicked', () => {
      renderWithProvider();

      const cancelButton = screen.getByTestId('cancel-button');
      fireEvent.click(cancelButton);

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Delete Functionality', () => {
    it('should call onDelete with node id when delete is clicked', () => {
      renderWithProvider();

      const deleteButton = screen.getByTestId('delete-button');
      fireEvent.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
      expect(mockOnDelete).toHaveBeenCalledWith('test-node-1');
    });

    it('should call onClose after delete', () => {
      renderWithProvider();

      const deleteButton = screen.getByTestId('delete-button');
      fireEvent.click(deleteButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Token Input Security', () => {
    it('should have type="password" for token input', () => {
      renderWithProvider();

      const tokenWrapper = screen.getByTestId('token-input');
      const tokenInput = tokenWrapper.querySelector(
        'input'
      ) as HTMLInputElement;

      expect(tokenInput).toHaveAttribute('type', 'password');
    });

    it('should replace a masked token with the typed value', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithSigningConfig(),
      });

      fireEvent.change(getTokenInput(), {
        target: { value: `${MASKED_PASSWORD_VALUE}ghp_new` },
      });

      expect(getTokenInput()).toHaveValue('ghp_new');

      fireEvent.click(screen.getByTestId('save-button'));

      expect(getSavedConfig().config.sinkConfig.credentials).toEqual({
        type: 'token',
        token: 'ghp_new',
      });
    });

    it('should send a masked token back as the mask when untouched', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithSigningConfig(),
      });

      fireEvent.click(screen.getByTestId('save-button'));

      expect(getSavedConfig().config.sinkConfig.credentials).toEqual({
        type: 'token',
        token: MASKED_PASSWORD_VALUE,
      });
    });
  });

  describe('Stored Webhook Sink', () => {
    it('should not carry webhook fields or masks into the git config', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockWebhookNode(),
      });

      fireEvent.change(getInputByTestId('repository-url-input'), {
        target: { value: 'https://github.com/org/repo.git' },
      });
      fireEvent.change(getTokenInput(), { target: { value: 'ghp_token' } });
      fireEvent.click(screen.getByTestId('save-button'));

      const { config } = getSavedConfig();

      expect(config.sinkType).toBe('git');
      expect(config.sinkConfig).toEqual({
        repositoryUrl: 'https://github.com/org/repo.git',
        branch: 'main',
        basePath: 'metadata',
        credentials: { type: 'token', token: 'ghp_token' },
        conflictResolution: 'overwriteExternal',
        commitConfig: {
          messageTemplate: 'Sync {entityType}: {entityName}',
          authorName: 'label.brand-name-bot',
          authorEmail: 'bot@openmetadata.org',
        },
      });
      expect(JSON.stringify(config.sinkConfig)).not.toContain(
        MASKED_PASSWORD_VALUE
      );
    });
  });

  describe('Stored Fields', () => {
    it('should keep sinkConfig and task config fields the form does not render', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithSigningConfig(),
      });

      fireEvent.change(getInputByTestId('branch-input'), {
        target: { value: 'develop' },
      });
      fireEvent.click(screen.getByTestId('save-button'));

      const { config } = getSavedConfig();

      expect(config).toEqual(
        expect.objectContaining({
          sinkType: 'git',
          outputFormat: 'json',
          batchMode: true,
          syncMode: 'overwrite',
        })
      );
      expect(config.sinkConfig).toEqual(
        expect.objectContaining({
          branch: 'develop',
          apiBaseUrl: 'https://github.mycompany.com/api',
          timeout: 120,
          retryConfig: { maxRetries: 5 },
          syncMetadata: { embed: true },
          credentials: { type: 'token', token: MASKED_PASSWORD_VALUE },
        })
      );
    });

    it('should save a cleared rendered field as cleared', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithSigningConfig(),
      });

      fireEvent.change(getInputByTestId('base-path-input'), {
        target: { value: '' },
      });
      fireEvent.click(screen.getByTestId('save-button'));

      expect(getSavedConfig().config.sinkConfig.basePath).toBe('');
    });
  });

  describe('Signing Key', () => {
    it('should render the signing key fields', () => {
      renderWithProvider();

      expect(
        screen.getByTestId('signing-private-key-input')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('signing-passphrase-input')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('allow-unsigned-fast-push-checkbox')
      ).toBeInTheDocument();
      expect(
        screen.getByText('message.git-sink-signing-key-hint')
      ).toBeInTheDocument();
      expect(
        screen.getByText('message.git-sink-unsigned-fast-push-hint')
      ).toBeInTheDocument();
    });

    it('should show a masked key as configured', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithSigningConfig(),
      });

      expect(
        screen.getByText('message.git-sink-signing-key-configured')
      ).toBeInTheDocument();
    });

    it('should send a masked key back as the mask when untouched', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithSigningConfig(),
      });

      fireEvent.click(screen.getByTestId('save-button'));

      expect(getSavedConfig().config.sinkConfig.signingKey).toEqual({
        privateKey: MASKED_PASSWORD_VALUE,
        passphrase: MASKED_PASSWORD_VALUE,
      });
    });

    it('should set signingKey from an entered key and passphrase', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithConfig(),
      });

      expect(getPassphraseInput()).toBeDisabled();

      fireEvent.change(getPrivateKeyInput(), {
        target: { value: ARMORED_KEY },
      });
      fireEvent.change(getPassphraseInput(), {
        target: { value: 'secret-phrase' },
      });
      fireEvent.click(screen.getByTestId('save-button'));

      expect(getSavedConfig().config.sinkConfig.signingKey).toEqual({
        privateKey: ARMORED_KEY,
        passphrase: 'secret-phrase',
      });
    });

    it('should leave passphrase out of signingKey when it is empty', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithConfig(),
      });

      fireEvent.change(getPrivateKeyInput(), {
        target: { value: ARMORED_KEY },
      });
      fireEvent.click(screen.getByTestId('save-button'));

      expect(getSavedConfig().config.sinkConfig.signingKey).toEqual({
        privateKey: ARMORED_KEY,
      });
    });

    it('should replace a masked key and reset its masked passphrase', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithSigningConfig(),
      });

      fireEvent.change(getPrivateKeyInput(), {
        target: { value: `${MASKED_PASSWORD_VALUE}${ARMORED_KEY}` },
      });

      expect(getPrivateKeyInput()).toHaveValue(ARMORED_KEY);
      expect(getPassphraseInput()).toHaveValue('');

      fireEvent.click(screen.getByTestId('save-button'));

      expect(getSavedConfig().config.sinkConfig.signingKey).toEqual({
        privateKey: ARMORED_KEY,
      });
    });

    it('should remove signingKey when the key is cleared', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithSigningConfig(),
      });

      fireEvent.change(getPrivateKeyInput(), { target: { value: '' } });
      fireEvent.click(screen.getByTestId('save-button'));

      expect(getSavedConfig().config.sinkConfig).not.toHaveProperty(
        'signingKey'
      );
    });

    it('should replace a masked passphrase and keep the masked key', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithSigningConfig(),
      });

      fireEvent.change(getPassphraseInput(), {
        target: { value: `${MASKED_PASSWORD_VALUE}new*phrase` },
      });

      expect(getPassphraseInput()).toHaveValue('new*phrase');

      fireEvent.click(screen.getByTestId('save-button'));

      expect(getSavedConfig().config.sinkConfig.signingKey).toEqual({
        privateKey: MASKED_PASSWORD_VALUE,
        passphrase: 'new*phrase',
      });
    });

    it('should keep text inserted inside a masked passphrase', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithSigningConfig(),
      });

      fireEvent.change(getPassphraseInput(), {
        target: { value: '****a*b*****' },
      });

      expect(getPassphraseInput()).toHaveValue('a*b');
    });

    it('should clear a masked key when one mask character is deleted', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithSigningConfig(),
      });

      fireEvent.change(getPrivateKeyInput(), {
        target: { value: MASKED_PASSWORD_VALUE.slice(1) },
      });

      expect(getPrivateKeyInput()).toHaveValue('');
    });
  });

  describe('Allow Unsigned Fast Push', () => {
    it('should set allowUnsignedFastPush when checked', () => {
      renderWithProvider({
        ...defaultProps,
        node: createMockNodeWithConfig(),
      });

      fireEvent.click(screen.getByTestId('allow-unsigned-fast-push-checkbox'));
      fireEvent.click(screen.getByTestId('save-button'));

      expect(getSavedConfig().config.sinkConfig.allowUnsignedFastPush).toBe(
        true
      );
    });

    it('should remove allowUnsignedFastPush when unchecked', () => {
      const node = createMockNodeWithSigningConfig();
      node.data.config.sinkConfig.allowUnsignedFastPush = true;
      renderWithProvider({ ...defaultProps, node });

      const checkbox = screen.getByTestId('allow-unsigned-fast-push-checkbox');

      expect(checkbox).toBeChecked();

      fireEvent.click(checkbox);
      fireEvent.click(screen.getByTestId('save-button'));

      expect(getSavedConfig().config.sinkConfig).not.toHaveProperty(
        'allowUnsignedFastPush'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle node without config gracefully', () => {
      const nodeWithoutConfig = createMockNode({
        data: {
          label: 'Empty Node',
        },
      });

      renderWithProvider({
        ...defaultProps,
        node: nodeWithoutConfig,
      });

      expect(getInputByTestId('branch-input')).toHaveValue('main');
      expect(getInputByTestId('base-path-input')).toHaveValue('metadata');
    });

    it('should handle node with partial config', () => {
      const nodeWithPartialConfig = createMockNode({
        data: {
          label: 'Partial Config',
          displayName: 'Partial Sink',
          config: {
            sinkConfig: {
              repositoryUrl: 'https://github.com/partial/repo.git',
            },
          },
        },
      });

      renderWithProvider({
        ...defaultProps,
        node: nodeWithPartialConfig,
      });

      expect(getInputByTestId('repository-url-input')).toHaveValue(
        'https://github.com/partial/repo.git'
      );
      expect(getInputByTestId('branch-input')).toHaveValue('main');

      const tokenWrapper = screen.getByTestId('token-input');
      const tokenInput = tokenWrapper.querySelector(
        'input'
      ) as HTMLInputElement;

      expect(tokenInput).toHaveValue('');
    });

    it('should handle undefined onDelete gracefully', () => {
      renderWithProvider({
        node: createMockNode(),
        onSave: mockOnSave,
        onClose: mockOnClose,
        onDelete: undefined,
      });

      const deleteButton = screen.getByTestId('delete-button');
      fireEvent.click(deleteButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
