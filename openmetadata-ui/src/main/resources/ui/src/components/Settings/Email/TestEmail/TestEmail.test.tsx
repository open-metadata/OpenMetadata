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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { testEmailConnection } from '../../../../rest/settingConfigAPI';
import TestEmail from './TestEmail.component';

jest.mock('../../../../rest/settingConfigAPI', () => ({
  testEmailConnection: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockOnCancel = jest.fn();

const mockProps = {
  onCancel: mockOnCancel,
};

describe('Test Email component', () => {
  it('should render test email component', () => {
    render(<TestEmail {...mockProps} />);

    expect(screen.getByTestId('test-email-modal')).toBeInTheDocument();
    expect(screen.getByText('label.test')).toBeInTheDocument();
  });

  it('should render test email component form', () => {
    render(<TestEmail {...mockProps} />);

    expect(screen.getByTestId('test-email-form')).toBeInTheDocument();
    expect(screen.getByText('label.email')).toBeInTheDocument();
    expect(screen.getByTestId('test-email-input')).toBeInTheDocument();
  });

  it('should trigger onCancel handler on cancel button click', () => {
    render(<TestEmail {...mockProps} />);

    const cancelButton = screen.getByText('Cancel');

    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should not trigger api if wrong email provided', async () => {
    render(<TestEmail {...mockProps} />);

    const input = screen.getByTestId('test-email-input');

    fireEvent.change(input, { target: { value: 'test.com' } });

    const submitButton = screen.getByText('label.test');

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(testEmailConnection).not.toHaveBeenCalled();

    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('should trigger api if correct email provided', async () => {
    render(<TestEmail {...mockProps} />);

    const input = screen.getByTestId('test-email-input');

    fireEvent.change(input, { target: { value: 'test@gmail.com' } });

    const submitButton = screen.getByText('label.test');

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(testEmailConnection).toHaveBeenCalled();

    expect(mockOnCancel).toHaveBeenCalled();
  });
});
