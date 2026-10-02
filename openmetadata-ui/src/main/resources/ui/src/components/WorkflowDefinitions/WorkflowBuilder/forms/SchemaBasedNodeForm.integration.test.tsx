/*
 *  Copyright 2026 Collate.
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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Node } from 'reactflow';
import {
  useWorkflowModeContext,
  WorkflowModeProvider,
} from '../../../../contexts/WorkflowModeContext';
import { NodeSubType } from '../../../../generated/governance/workflows/elements/nodeSubType';
import { SchemaBasedNodeForm } from './SchemaBasedNodeForm';

jest.mock('@openmetadata/ui-core-components', () => {
  const Input = (props: {
    value?: string;
    onChange?: (value: string) => void;
    label?: string;
    'data-testid'?: string;
    isRequired?: boolean;
    isDisabled?: boolean;
  }) => {
    const {
      value = '',
      onChange,
      label,
      'data-testid': dataTestId,
      isRequired,
      isDisabled,
    } = props;

    return (
      <label htmlFor={dataTestId}>
        {label}
        {isRequired && <span> *</span>}
        <input
          aria-label={label}
          data-testid={dataTestId}
          disabled={isDisabled}
          id={dataTestId}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </label>
    );
  };

  const TextArea = (props: {
    value?: string;
    onChange?: (value: string) => void;
    label?: string;
    'data-testid'?: string;
    placeholder?: string;
    rows?: number;
    isDisabled?: boolean;
  }) => {
    const {
      value = '',
      onChange,
      label,
      'data-testid': dataTestId,
      placeholder,
      rows,
      isDisabled,
    } = props;

    return (
      <label htmlFor={dataTestId}>
        {label}
        <textarea
          aria-label={label}
          data-testid={dataTestId}
          disabled={isDisabled}
          id={dataTestId}
          placeholder={placeholder}
          rows={rows}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </label>
    );
  };

  const Toggle = (props: {
    isSelected?: boolean;
    isDisabled?: boolean;
    onChange?: () => void;
  }) => (
    <input
      aria-label="toggle"
      checked={props.isSelected ?? false}
      data-testid="toggle"
      disabled={props.isDisabled}
      type="checkbox"
      onChange={() => props.onChange?.()}
    />
  );

  const Typography = (props: {
    children?: React.ReactNode;
    className?: string;
  }) => <span className={props.className}>{props.children}</span>;

  return { Input, TextArea, Toggle, Typography };
});

jest.mock('./FormActionButtons', () => ({
  FormActionButtons: jest
    .fn()
    .mockImplementation(
      ({
        onCancel,
        cancelLabel,
      }: {
        onCancel: () => void;
        cancelLabel?: string;
      }) => (
        <div data-testid="form-action-buttons">
          <button data-testid="cancel-button" onClick={onCancel}>
            {cancelLabel ?? 'Cancel'}
          </button>
        </div>
      )
    ),
}));

const ModeProbe = () => {
  const { mode, isFormDisabled } = useWorkflowModeContext();

  return (
    <div
      data-form-disabled={String(isFormDisabled)}
      data-mode={mode}
      data-testid="mode-probe"
    />
  );
};

const makeNode = (
  subType: NodeSubType,
  overrides: Partial<Node['data']> = {}
): Node => ({
  id: 'node-1',
  position: { x: 0, y: 0 },
  type: 'automatedTask',
  data: {
    subType,
    displayName: 'Test Node',
    description: 'Test description',
    config: {},
    ...overrides,
  },
});

const renderInMode = (mode: 'edit' | 'view', ui: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={[`/?mode=${mode}`]}>
      <WorkflowModeProvider>{ui}</WorkflowModeProvider>
    </MemoryRouter>
  );

describe('SchemaBasedNodeForm name/description lock states (integration)', () => {
  it('locks name and description inputs in Edit mode (isFormDisabled=false)', () => {
    renderInMode(
      'edit',
      <>
        <ModeProbe />
        <SchemaBasedNodeForm
          node={makeNode(NodeSubType.CreateRecognizerFeedbackApprovalTask)}
          onClose={jest.fn()}
        />
      </>
    );

    // Guard: confirm the real WorkflowModeProvider derived Edit mode exactly
    // (isFormDisabled === false is the state the bug surfaces in).
    expect(screen.getByTestId('mode-probe')).toHaveAttribute(
      'data-mode',
      'edit'
    );
    expect(screen.getByTestId('mode-probe')).toHaveAttribute(
      'data-form-disabled',
      'false'
    );

    // Fix: lockFields must disable both fields even though isFormDisabled is false.
    expect(screen.getByTestId('workflow-name-input')).toBeDisabled();
    expect(screen.getByTestId('workflow-description-input')).toBeDisabled();
  });

  it('keeps name and description inputs disabled in View mode (isFormDisabled=true)', () => {
    renderInMode(
      'view',
      <>
        <ModeProbe />
        <SchemaBasedNodeForm
          node={makeNode(NodeSubType.ApplyRecognizerFeedbackTask)}
          onClose={jest.fn()}
        />
      </>
    );

    expect(screen.getByTestId('mode-probe')).toHaveAttribute(
      'data-mode',
      'view'
    );
    expect(screen.getByTestId('mode-probe')).toHaveAttribute(
      'data-form-disabled',
      'true'
    );

    expect(screen.getByTestId('workflow-name-input')).toBeDisabled();
    expect(screen.getByTestId('workflow-description-input')).toBeDisabled();
  });

  it('renders displayName and description values from node data', () => {
    renderInMode(
      'edit',
      <SchemaBasedNodeForm
        node={makeNode(NodeSubType.RejectRecognizerFeedbackTask, {
          displayName: 'Reject Feedback',
          description: 'Rejects the recognizer feedback',
        })}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByDisplayValue('Reject Feedback')).toBeDisabled();
    expect(
      screen.getByDisplayValue('Rejects the recognizer feedback')
    ).toBeDisabled();
  });

  it('falls back to node label when displayName is missing', () => {
    renderInMode(
      'edit',
      <SchemaBasedNodeForm
        node={makeNode(NodeSubType.RunAppTask, {
          displayName: undefined,
          label: 'Fallback Label',
        })}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByDisplayValue('Fallback Label')).toBeDisabled();
  });
});
