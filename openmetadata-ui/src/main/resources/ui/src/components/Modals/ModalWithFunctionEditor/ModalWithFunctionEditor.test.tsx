/*
 *  Copyright 2024 Collate.
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
import { AxiosError } from 'axios';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ModalWithFunctionEditor } from './ModalWithFunctionEditor';

// Mock dependencies
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

// Mock Loader to match the actual implementation that uses a single "loader" data-testid
jest.mock('../../common/Loader/Loader', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="loader">Loader</div>);
});

const mockOnSave = jest.fn().mockImplementation(() => Promise.resolve());
const mockOnCancel = jest.fn();

const mockProps = {
  header: 'Test Header',
  value: 'SELECT * FROM test_table',
  visible: true,
  onSave: mockOnSave,
  onCancel: mockOnCancel,
};

describe('ModalWithFunctionEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the modal with correct header and form with initial value', async () => {
    render(<ModalWithFunctionEditor {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('sql-function-input')).toBeInTheDocument();
    });

    expect(screen.getByTestId('header')).toHaveTextContent('Test Header');

    const input = screen.getByTestId('sql-function-input');

    expect(input).toHaveValue('SELECT * FROM test_table');
  });

  it('should call onCancel when the cancel button is clicked', async () => {
    render(<ModalWithFunctionEditor {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('cancel')).toBeInTheDocument();
    });

    const cancelButton = screen.getByTestId('cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onSave with the input value when the save button is clicked', async () => {
    render(<ModalWithFunctionEditor {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('save')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('save');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockOnSave).toHaveBeenCalledWith('SELECT * FROM test_table');
  });

  it('should update the input value when changed', async () => {
    render(<ModalWithFunctionEditor {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('sql-function-input')).toBeInTheDocument();
    });

    const input = screen.getByTestId('sql-function-input');

    await act(async () => {
      fireEvent.change(input, {
        target: { value: 'SELECT id FROM new_table' },
      });
    });

    expect(input).toHaveValue('SELECT id FROM new_table');
  });

  it('should show error toast when save fails', async () => {
    const error = new Error('Test error') as AxiosError;
    const mockOnSaveWithError = jest.fn().mockRejectedValue(error);

    render(
      <ModalWithFunctionEditor {...mockProps} onSave={mockOnSaveWithError} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('save')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('save');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(error);
    });

    expect(mockOnSaveWithError).toHaveBeenCalledWith(
      'SELECT * FROM test_table'
    );
  });

  it('should validate required fields', async () => {
    render(<ModalWithFunctionEditor {...mockProps} value="" />);

    await waitFor(() => {
      expect(screen.getByTestId('save')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('save');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      const errorMessage = screen.getByText(/label.field-required/);

      expect(errorMessage).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });
});
