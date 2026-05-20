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
            <label>{label}</label>
            {isRequired && <span> *</span>}
          </>
        )}
        <input
          disabled={isDisabled}
          role="textbox"
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
        {label != null && <label>{label}</label>}
        <select
          data-testid={dataTestId}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}>
          {children}
        </select>
      </div>
    );
  };

  const SelectWithItem = Object.assign(Select, { Item: SelectItem });

  return { Input, Select: SelectWithItem };
});

jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useTheme: () => ({
    palette: {
      allShades: {
        gray: {
          300: '#d1d5db',
          700: '#374151',
          900: '#111827',
        },
      },
      error: {
        main: '#ef4444',
      },
    },
  }),
}));

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
        data-testid="display-name-input"
        defaultValue={name}
        placeholder="Display Name"
      />
      <input
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

const mockOnSave = jest.fn();
const mockOnClose = jest.fn();
const mockOnDelete = jest.fn();

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
      const tokenInput = tokenWrapper.querySelector('input');
      fireEvent.change(tokenInput!, { target: { value: 'ghp_test' } });

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
      const tokenInput = tokenWrapper.querySelector('input');
      fireEvent.change(tokenInput!, {
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
      const tokenInput = tokenWrapper.querySelector('input');

      expect(tokenInput).toHaveAttribute('type', 'password');
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
      const tokenInput = tokenWrapper.querySelector('input');

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
