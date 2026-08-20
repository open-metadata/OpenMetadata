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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Node } from 'reactflow';
import { NodeSubType } from '../../../../generated/governance/workflows/elements/nodeSubType';
import { SchemaBasedNodeForm } from './SchemaBasedNodeForm';

jest.mock('@openmetadata/ui-core-components', () => {
  const Input = (props: {
    value?: string;
    label?: string;
    isDisabled?: boolean;
  }) => (
    <div>
      {props.label && <label>{props.label}</label>}
      <input
        readOnly
        disabled={props.isDisabled}
        value={props.value ?? ''}
        onChange={() => {
          return;
        }}
      />
    </div>
  );

  const TextArea = (props: {
    value?: string;
    label?: string;
    isDisabled?: boolean;
  }) => (
    <div>
      {props.label && <label>{props.label}</label>}
      <textarea
        readOnly
        disabled={props.isDisabled}
        value={props.value ?? ''}
        onChange={() => {
          return;
        }}
      />
    </div>
  );

  const Toggle = (props: { isSelected?: boolean; isDisabled?: boolean }) => (
    <input
      readOnly
      checked={props.isSelected ?? false}
      data-testid="toggle"
      disabled={props.isDisabled}
      type="checkbox"
    />
  );

  const Typography = (props: {
    children?: React.ReactNode;
    className?: string;
  }) => <span className={props.className}>{props.children}</span>;

  return { Input, TextArea, Toggle, Typography };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../contexts/WorkflowModeContext', () => ({
  useWorkflowModeContext: jest.fn(() => ({
    isFormDisabled: true,
    canSave: false,
    allowStructuralGraphEdits: false,
  })),
}));

jest.mock('./MetadataFormSection', () => ({
  MetadataFormSection: jest.fn().mockImplementation(({ name, description }) => (
    <div data-testid="metadata-form-section">
      <span data-testid="node-name">{name}</span>
      <span data-testid="node-description">{description}</span>
    </div>
  )),
}));

jest.mock('./FormActionButtons', () => ({
  FormActionButtons: jest
    .fn()
    .mockImplementation(({ onCancel, cancelLabel, showSave }) => (
      <div data-testid="form-action-buttons">
        <button data-testid="cancel-button" onClick={onCancel}>
          {cancelLabel ?? 'Cancel'}
        </button>
        {showSave !== false && <button data-testid="save-button">Save</button>}
      </div>
    )),
}));

const makeNode = (
  subType: string,
  config: Record<string, unknown> = {},
  overrides: Partial<Node['data']> = {}
): Node => ({
  id: 'node-1',
  type: 'automatedTask',
  position: { x: 0, y: 0 },
  data: {
    subType,
    displayName: 'Test Node',
    description: 'Test description',
    config,
    ...overrides,
  },
});

const mockOnClose = jest.fn();

describe('SchemaBasedNodeForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('MetadataFormSection', () => {
    it('renders node displayName and description', () => {
      render(
        <SchemaBasedNodeForm
          node={makeNode(NodeSubType.RunAppTask, {})}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('node-name')).toHaveTextContent('Test Node');
      expect(screen.getByTestId('node-description')).toHaveTextContent(
        'Test description'
      );
    });

    it('falls back to label when displayName is missing', () => {
      const node = makeNode(
        NodeSubType.RunAppTask,
        {},
        {
          displayName: undefined,
          label: 'Fallback Label',
        }
      );

      render(<SchemaBasedNodeForm node={node} onClose={mockOnClose} />);

      expect(screen.getByTestId('node-name')).toHaveTextContent(
        'Fallback Label'
      );
    });
  });

  describe('Config field rendering — known subtype (RunAppTask)', () => {
    const config = {
      appName: 'DataInsightsApplication',
      waitForCompletion: true,
      timeoutSeconds: 3600,
    };

    it('renders string field as disabled Input with schema title as label', () => {
      render(
        <SchemaBasedNodeForm
          node={makeNode(NodeSubType.RunAppTask, config)}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('App Name')).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('DataInsightsApplication')
      ).toBeInTheDocument();
    });

    it('renders integer field as disabled Input', () => {
      render(
        <SchemaBasedNodeForm
          node={makeNode(NodeSubType.RunAppTask, config)}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Timeout Seconds')).toBeInTheDocument();
      expect(screen.getByDisplayValue('3600')).toBeInTheDocument();
    });

    it('renders boolean field as disabled Toggle', () => {
      render(
        <SchemaBasedNodeForm
          node={makeNode(NodeSubType.RunAppTask, config)}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Wait for Completion')).toBeInTheDocument();

      const toggle = screen.getByTestId('toggle');

      expect(toggle).toBeChecked();
      expect(toggle).toBeDisabled();
    });

    it('renders false boolean Toggle as unchecked', () => {
      render(
        <SchemaBasedNodeForm
          node={makeNode(NodeSubType.RunAppTask, {
            ...config,
            waitForCompletion: false,
          })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('toggle')).not.toBeChecked();
    });
  });

  describe('Config field rendering — object value', () => {
    it('renders object config value as disabled TextArea with JSON', () => {
      const assignees = {
        addReviewers: true,
        addOwners: false,
        candidates: [],
      };

      render(
        <SchemaBasedNodeForm
          node={makeNode(NodeSubType.CreateRecognizerFeedbackApprovalTask, {
            assignees,
          })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Assignees')).toBeInTheDocument();

      const textarea = screen.getByRole('textbox');

      expect(textarea).toHaveValue(JSON.stringify(assignees, null, 2));
    });
  });

  describe('Config field rendering — unknown subtype', () => {
    it('uses raw key name as label when subtype has no schema entry', () => {
      render(
        <SchemaBasedNodeForm
          node={makeNode('unknownFutureTask', { policyName: 'MyPolicy' })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('policyName')).toBeInTheDocument();
      expect(screen.getByDisplayValue('MyPolicy')).toBeInTheDocument();
    });

    it('renders all config keys for unknown subtype without schema', () => {
      render(
        <SchemaBasedNodeForm
          node={makeNode('unknownFutureTask', {
            field1: 'value1',
            field2: 42,
            flag: false,
          })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('field1')).toBeInTheDocument();
      expect(screen.getByText('field2')).toBeInTheDocument();
      expect(screen.getByText('flag')).toBeInTheDocument();
    });
  });

  describe('Empty config', () => {
    it('renders only MetadataFormSection when config is empty', () => {
      render(
        <SchemaBasedNodeForm
          node={makeNode(NodeSubType.ApplyRecognizerFeedbackTask, {})}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('metadata-form-section')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByTestId('toggle')).not.toBeInTheDocument();
    });
  });

  describe('Action buttons', () => {
    it('renders Close button and not Save button', () => {
      render(
        <SchemaBasedNodeForm
          node={makeNode(NodeSubType.RunAppTask, {})}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('cancel-button')).toHaveTextContent(
        'label.close'
      );
      expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
    });

    it('calls onClose when Close button is clicked', () => {
      render(
        <SchemaBasedNodeForm
          node={makeNode(NodeSubType.RunAppTask, {})}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByTestId('cancel-button'));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
