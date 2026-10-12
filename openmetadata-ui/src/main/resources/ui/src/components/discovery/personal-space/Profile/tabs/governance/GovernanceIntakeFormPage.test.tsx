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
  getIntakeFormById: jest.fn(),
  createIntakeForm: jest.fn(),
  createOrUpdateIntakeForm: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../../pages/IntakeForms/IntakeFormDesignerBody', () => {
  const Component = React.forwardRef(
    (
      props: { onSubmit: (payload: unknown) => Promise<void>; open: boolean },
      ref: React.Ref<{ submit: () => Promise<void> }>
    ) => {
      React.useImperativeHandle(ref, () => ({
        submit: () =>
          props.onSubmit({
            name: 'dataProduct',
            entityType: 'dataProduct',
            enabled: true,
            formFields: [],
          }),
      }));

      return <div data-testid="intake-form-designer-body" />;
    }
  );
  Component.displayName = 'IntakeFormDesignerBody';

  return { __esModule: true, default: Component };
});

jest.mock('@openmetadata/ui-core-components', () => ({
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
    isLoading,
    isDisabled,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    'data-testid'?: string;
    isLoading?: boolean;
    isDisabled?: boolean;
  }) => (
    <button
      data-loading={isLoading}
      data-testid={testId}
      disabled={isDisabled}
      onClick={onPress}>
      {children}
    </button>
  ),
}));

import {
  createIntakeForm,
  createOrUpdateIntakeForm,
  getIntakeFormById,
} from '../../../../../../rest/intakeFormsAPI';
import GovernanceIntakeFormPage from './GovernanceIntakeFormPage';

const mockGetIntakeFormById = getIntakeFormById as jest.Mock;
const mockCreateIntakeForm = createIntakeForm as jest.Mock;
const mockCreateOrUpdateIntakeForm = createOrUpdateIntakeForm as jest.Mock;

const mockOnNavigate = jest.fn();

const renderAdd = () =>
  render(
    <MemoryRouter>
      <GovernanceIntakeFormPage
        entityType={TargetEntityType.DataProduct}
        onNavigate={mockOnNavigate}
      />
    </MemoryRouter>
  );

const renderEdit = () =>
  render(
    <MemoryRouter>
      <GovernanceIntakeFormPage editId="form-42" onNavigate={mockOnNavigate} />
    </MemoryRouter>
  );

describe('GovernanceIntakeFormPage — add mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateIntakeForm.mockResolvedValue({
      id: 'new-form',
      entityType: 'dataProduct',
    });
  });

  it('renders the intake form page and designer body', () => {
    renderAdd();

    expect(screen.getByTestId('intake-form-page')).toBeInTheDocument();
    expect(screen.getByTestId('intake-form-designer-body')).toBeInTheDocument();
  });

  it('renders submit and cancel buttons', () => {
    renderAdd();

    expect(screen.getByTestId('intake-form-submit')).toBeInTheDocument();
    expect(screen.getByTestId('intake-form-cancel')).toBeInTheDocument();
  });

  it('navigates back to intake-list on cancel', () => {
    renderAdd();
    fireEvent.click(screen.getByTestId('intake-form-cancel'));

    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'intake-list' });
  });

  it('calls createIntakeForm via ref submit and navigates', async () => {
    renderAdd();
    await act(async () => {
      fireEvent.click(screen.getByTestId('intake-form-submit'));
    });

    expect(mockCreateIntakeForm).toHaveBeenCalled();
    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'intake-list' });
  });

  it('does not call createOrUpdateIntakeForm in add mode', async () => {
    renderAdd();
    await act(async () => {
      fireEvent.click(screen.getByTestId('intake-form-submit'));
    });

    expect(mockCreateOrUpdateIntakeForm).not.toHaveBeenCalled();
  });
});

describe('GovernanceIntakeFormPage — edit mode', () => {
  const existingForm = {
    id: 'form-42',
    name: 'domain',
    entityType: TargetEntityType.Domain,
    enabled: true,
    formFields: [],
    requiredFields: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIntakeFormById.mockResolvedValue(existingForm);
    mockCreateOrUpdateIntakeForm.mockResolvedValue(existingForm);
  });

  it('shows loading while fetching the existing form', () => {
    mockGetIntakeFormById.mockReturnValue(new Promise(() => {}));
    renderEdit();

    expect(screen.getByText('label.loading')).toBeInTheDocument();
  });

  const renderEditAndWait = async () => {
    renderEdit();
    await act(async () => {});
  };

  it('renders the designer body after fetching', async () => {
    await renderEditAndWait();

    expect(screen.getByTestId('intake-form-designer-body')).toBeInTheDocument();
  });

  it('calls createOrUpdateIntakeForm and navigates on submit', async () => {
    await renderEditAndWait();
    await act(async () => {
      fireEvent.click(screen.getByTestId('intake-form-submit'));
    });

    expect(mockCreateOrUpdateIntakeForm).toHaveBeenCalled();
    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'intake-list' });
  });

  it('does not call createIntakeForm in edit mode', async () => {
    await renderEditAndWait();
    await act(async () => {
      fireEvent.click(screen.getByTestId('intake-form-submit'));
    });

    expect(mockCreateIntakeForm).not.toHaveBeenCalled();
  });
});
