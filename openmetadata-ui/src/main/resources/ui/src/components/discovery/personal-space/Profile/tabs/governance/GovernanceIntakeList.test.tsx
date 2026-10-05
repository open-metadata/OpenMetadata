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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TargetEntityType } from '../../../../../../generated/governance/intakeForm';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../rest/intakeFormsAPI', () => ({
  listIntakeForms: jest.fn(),
  patchIntakeForm: jest.fn(),
  deleteIntakeForm: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../../../../components/common/EmptyPlaceholder/CreatePlaceholder',
  () =>
    jest.fn(({ 'data-testid': testId }: { 'data-testid'?: string }) => (
      <div data-testid={testId} />
    ))
);

jest.mock('../../../../../../pages/IntakeForms/IntakeFormsTable', () =>
  jest.fn(
    ({
      forms,
      onEdit,
      onDelete,
      onToggleEnabled,
    }: {
      forms: Array<{ id: string; entityType: string; enabled: boolean }>;
      onEdit: (form: { id: string }) => void;
      onDelete: (form: { id: string; entityType: string }) => void;
      onToggleEnabled: (form: { id: string }, enabled: boolean) => void;
    }) => (
      <div data-testid="intake-forms-table">
        {forms.map((f) => (
          <div key={f.id}>
            <span data-testid={`row-${f.entityType}`}>{f.entityType}</span>
            <button
              data-testid={`edit-${f.entityType}`}
              onClick={() => onEdit(f)}>
              Edit
            </button>
            <button
              data-testid={`delete-${f.entityType}`}
              onClick={() => onDelete(f)}>
              Delete
            </button>
            <button
              data-testid={`toggle-${f.entityType}`}
              onClick={() => onToggleEnabled(f, !f.enabled)}>
              Toggle
            </button>
          </div>
        ))}
      </div>
    )
  )
);

jest.mock('@openmetadata/ui-core-components', () => {
  const DialogContent = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  const DialogFooter = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  const Dialog = Object.assign(
    ({
      children,
      title,
      'data-testid': testId,
    }: {
      children?: React.ReactNode;
      title?: string;
      'data-testid'?: string;
    }) => (
      <div data-testid={testId ?? 'dialog'} role="dialog">
        <span>{title}</span>
        {children}
      </div>
    ),
    { Content: DialogContent, Footer: DialogFooter }
  );

  const DropdownItem = ({
    label,
    id,
    isDisabled,
    'data-testid': testId,
  }: {
    label?: string;
    id?: string;
    isDisabled?: boolean;
    'data-testid'?: string;
  }) => (
    <div
      aria-disabled={isDisabled ? 'true' : undefined}
      data-testid={testId}
      role="menuitem">
      {label ?? id}
    </div>
  );

  const DropdownMenu = ({
    items,
    onAction,
    children,
  }: {
    items?: Array<{ id: string; label: string; isDisabled: boolean }>;
    onAction?: (key: string) => void;
    children?: (item: {
      id: string;
      label: string;
      isDisabled: boolean;
    }) => React.ReactNode;
  }) => (
    <div role="menu">
      {(items ?? []).map((item) =>
        children ? children({ ...item, onAction } as typeof item) : null
      )}
    </div>
  );

  const Dropdown = Object.assign(
    ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    {
      Root: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Popover: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Menu: DropdownMenu,
      Item: DropdownItem,
    }
  );

  return {
    Box: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    Button: ({
      children,
      onPress,
      'data-testid': testId,
      isDisabled,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      'data-testid'?: string;
      isDisabled?: boolean;
    }) => (
      <button data-testid={testId} disabled={isDisabled} onClick={onPress}>
        {children}
      </button>
    ),
    Dialog,
    Dropdown,
    Modal: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    ModalOverlay: ({
      children,
      isOpen,
    }: {
      children?: React.ReactNode;
      isOpen?: boolean;
    }) => (isOpen ? <div data-testid="modal-overlay">{children}</div> : null),
    Tooltip: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Typography: ({ children }: { children?: React.ReactNode }) => (
      <span>{children}</span>
    ),
  };
});

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Building01: () => <svg />,
  ChevronDown: () => <svg />,
}));

import {
  deleteIntakeForm,
  listIntakeForms,
  patchIntakeForm,
} from '../../../../../../rest/intakeFormsAPI';
import GovernanceIntakeList from './GovernanceIntakeList';

const mockListIntakeForms = listIntakeForms as jest.Mock;
const mockPatchIntakeForm = patchIntakeForm as jest.Mock;
const mockDeleteIntakeForm = deleteIntakeForm as jest.Mock;

const mockForm = {
  id: 'form-1',
  entityType: TargetEntityType.DataProduct,
  enabled: true,
  formFields: [],
  requiredFields: [],
  name: 'dataProduct',
};

const mockOnNavigate = jest.fn();

const renderComponent = () =>
  render(
    <MemoryRouter>
      <GovernanceIntakeList onNavigate={mockOnNavigate} />
    </MemoryRouter>
  );

describe('GovernanceIntakeList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListIntakeForms.mockResolvedValue({ data: [mockForm] });
    mockPatchIntakeForm.mockResolvedValue({ ...mockForm, enabled: false });
    mockDeleteIntakeForm.mockResolvedValue({});
  });

  const renderAndWait = async () => {
    renderComponent();
    await act(async () => {});
  };

  it('renders the table after fetching forms', async () => {
    await renderAndWait();

    expect(screen.getByTestId('intake-forms-table')).toBeInTheDocument();
    expect(
      screen.getByTestId(`row-${TargetEntityType.DataProduct}`)
    ).toBeInTheDocument();
  });

  it('provides the "Add Intake Form" button to the parent header', async () => {
    const onSetHeaderActions = jest.fn();
    render(
      <MemoryRouter>
        <GovernanceIntakeList
          onNavigate={mockOnNavigate}
          onSetHeaderActions={onSetHeaderActions}
        />
      </MemoryRouter>
    );
    await act(async () => {});

    const headerActions = onSetHeaderActions.mock.calls.at(-1)?.[0];
    render(<MemoryRouter>{headerActions}</MemoryRouter>);

    expect(screen.getByTestId('add-intake-form')).toBeInTheDocument();
  });

  it('calls onNavigate with intake-edit when edit is clicked', async () => {
    await renderAndWait();
    fireEvent.click(screen.getByTestId(`edit-${TargetEntityType.DataProduct}`));

    expect(mockOnNavigate).toHaveBeenCalledWith({
      type: 'intake-edit',
      id: 'form-1',
    });
  });

  it('calls patchIntakeForm when toggle is clicked', async () => {
    await renderAndWait();
    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`toggle-${TargetEntityType.DataProduct}`)
      );
    });

    expect(mockPatchIntakeForm).toHaveBeenCalledWith(
      'form-1',
      expect.arrayContaining([
        expect.objectContaining({ op: 'replace', path: '/enabled' }),
      ])
    );
  });

  it('opens delete confirm dialog when delete is clicked', async () => {
    await renderAndWait();
    fireEvent.click(
      screen.getByTestId(`delete-${TargetEntityType.DataProduct}`)
    );

    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
    expect(
      screen.getByTestId('intake-form-delete-confirm')
    ).toBeInTheDocument();
  });

  it('calls deleteIntakeForm on confirm', async () => {
    await renderAndWait();
    fireEvent.click(
      screen.getByTestId(`delete-${TargetEntityType.DataProduct}`)
    );
    await act(async () => {
      fireEvent.click(screen.getByText('label.delete'));
    });

    expect(mockDeleteIntakeForm).toHaveBeenCalledWith('form-1');
  });

  it('closes delete dialog on cancel without deleting', async () => {
    await renderAndWait();
    fireEvent.click(
      screen.getByTestId(`delete-${TargetEntityType.DataProduct}`)
    );

    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();

    fireEvent.click(screen.getByText('label.cancel'));

    expect(mockDeleteIntakeForm).not.toHaveBeenCalled();
  });
});
