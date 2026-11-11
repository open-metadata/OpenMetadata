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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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

import {
  deleteIntakeForm,
  listIntakeForms,
  patchIntakeForm,
} from '../../../../../../rest/intakeFormsAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
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
        screen
          .getByTestId(`toggle-${TargetEntityType.DataProduct}`)
          .querySelector('input') as HTMLInputElement
      );
    });

    expect(mockPatchIntakeForm).toHaveBeenCalledWith(
      'form-1',
      expect.arrayContaining([
        expect.objectContaining({ op: 'replace', path: '/enabled' }),
      ])
    );
  });

  it('opens the delete confirmation popover when delete is clicked', async () => {
    await renderAndWait();
    fireEvent.click(
      screen.getByTestId(`delete-${TargetEntityType.DataProduct}`)
    );

    expect(
      await screen.findByTestId('intake-form-delete-popover')
    ).toBeInTheDocument();
  });

  it('calls deleteIntakeForm on confirm and reloads the forms', async () => {
    await renderAndWait();
    fireEvent.click(
      screen.getByTestId(`delete-${TargetEntityType.DataProduct}`)
    );
    await act(async () => {
      fireEvent.click(
        await screen.findByTestId('intake-form-delete-popover-confirm')
      );
    });

    expect(mockDeleteIntakeForm).toHaveBeenCalledWith('form-1');
    expect(mockListIntakeForms).toHaveBeenCalledTimes(2);
  });

  it('keeps the popover open without reloading when the delete fails', async () => {
    mockDeleteIntakeForm.mockRejectedValue(new Error('boom'));
    await renderAndWait();
    fireEvent.click(
      screen.getByTestId(`delete-${TargetEntityType.DataProduct}`)
    );
    await act(async () => {
      fireEvent.click(
        await screen.findByTestId('intake-form-delete-popover-confirm')
      );
    });

    expect(showErrorToast).toHaveBeenCalled();
    expect(mockListIntakeForms).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('intake-form-delete-popover')
    ).toBeInTheDocument();
  });

  it('closes the popover on cancel without deleting', async () => {
    await renderAndWait();
    fireEvent.click(
      screen.getByTestId(`delete-${TargetEntityType.DataProduct}`)
    );
    fireEvent.click(
      await screen.findByTestId('intake-form-delete-popover-cancel')
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId('intake-form-delete-popover')
      ).not.toBeInTheDocument()
    );

    expect(mockDeleteIntakeForm).not.toHaveBeenCalled();
  });
});
