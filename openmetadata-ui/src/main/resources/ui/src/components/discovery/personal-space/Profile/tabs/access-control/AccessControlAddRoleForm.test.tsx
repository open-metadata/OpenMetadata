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

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  addRole: jest.fn().mockResolvedValue({}),
  getPolicies: jest.fn().mockResolvedValue({ data: [], paging: {} }),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../common/Loader/Loader', () => () => (
  <div data-testid="loader" />
));

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
  Autocomplete: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="autocomplete">{children}</div>
  ),
  SelectItemType: {},
  TextArea: ({ 'data-testid': testId }: { 'data-testid'?: string }) => (
    <textarea data-testid={testId} />
  ),
}));

import { getPolicies } from '../../../../../../rest/rolesAPIV1';
import AccessControlAddRoleForm from './AccessControlAddRoleForm';

const mockOnNavigate = jest.fn();

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AccessControlAddRoleForm onNavigate={mockOnNavigate} />
    </MemoryRouter>
  );

describe('AccessControlAddRoleForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPolicies as jest.Mock).mockResolvedValue({ data: [], paging: {} });
  });

  it('shows loader while fetching policies', () => {
    (getPolicies as jest.Mock).mockReturnValue(new Promise(() => {}));
    renderComponent();

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('renders the form after policies are loaded', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('add-role-container')).toBeInTheDocument();
    });

    expect(screen.getByTestId('role-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });

  it('renders cancel and submit buttons', async () => {
    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('cancel-btn')).toBeInTheDocument()
    );

    expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
  });

  it('navigates to roles on cancel click', async () => {
    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('cancel-btn')).toBeInTheDocument()
    );

    screen.getByTestId('cancel-btn').click();

    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'roles' });
  });

  it('shows rich text editor for description', async () => {
    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument()
    );
  });
});
