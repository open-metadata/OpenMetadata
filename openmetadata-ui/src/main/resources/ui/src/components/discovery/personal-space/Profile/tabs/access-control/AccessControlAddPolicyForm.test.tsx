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

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  addPolicy: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () =>
  React.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      getEditorContent: () => 'test description',
      clearEditorContent: jest.fn(),
      setEditorContent: jest.fn(),
    }));

    return <div data-testid="rich-text-editor" />;
  })
);

jest.mock('./AccessControlRuleForm', () => () => (
  <div data-testid="rule-form" />
));

// Mock core-ui components with native HTML to avoid react-aria provider requirements
jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  ),
  Button: ({
    children,
    onPress,
    'data-testid': testId,
    isLoading,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    'data-testid'?: string;
    isLoading?: boolean;
  }) => (
    <button
      data-loading={isLoading}
      data-testid={testId}
      type="button"
      onClick={onPress}>
      {children}
    </button>
  ),
  Input: ({
    onChange,
    value,
    'data-testid': testId,
    placeholder,
  }: {
    onChange?: (v: string) => void;
    value?: string;
    'data-testid'?: string;
    placeholder?: string;
  }) => (
    <input
      data-testid={testId}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
  Typography: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

import AccessControlAddPolicyForm from './AccessControlAddPolicyForm';

const mockOnNavigate = jest.fn();

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AccessControlAddPolicyForm onNavigate={mockOnNavigate} />
    </MemoryRouter>
  );

describe('AccessControlAddPolicyForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all form fields', () => {
    renderComponent();

    expect(screen.getByTestId('policy-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
    expect(screen.getByTestId('rule-form')).toBeInTheDocument();
  });

  it('renders cancel and submit buttons', () => {
    renderComponent();

    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
    expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
  });

  it('navigates to policies on cancel click', async () => {
    renderComponent();

    screen.getByTestId('cancel-btn').click();

    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'policies' });
  });

  it('has a description rich text editor', () => {
    renderComponent();

    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });

  it('shows the embedded rule form', () => {
    renderComponent();

    expect(screen.getByTestId('rule-form')).toBeInTheDocument();
  });
});
