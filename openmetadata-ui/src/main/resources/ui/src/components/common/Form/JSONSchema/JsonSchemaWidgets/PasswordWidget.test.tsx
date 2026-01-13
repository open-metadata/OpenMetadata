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

import { Registry, WidgetProps } from '@rjsf/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  MOCK_FILE_SELECT_WIDGET,
  MOCK_PASSWORD_WIDGET,
} from '../../../../../mocks/Widgets.mock';
import PasswordWidget from './PasswordWidget';

jest.mock('./FileUploadWidget', () =>
  jest
    .fn()
    .mockImplementation(({ disabled }) => (
      <button disabled={disabled}>FileUploadWidget</button>
    ))
);

const mockOnFocus = jest.fn();
const mockOnBlur = jest.fn();
const mockOnChange = jest.fn();

const mockProps: WidgetProps = {
  onFocus: mockOnFocus,
  onBlur: mockOnBlur,
  onChange: mockOnChange,
  registry: {} as Registry,
  ...MOCK_PASSWORD_WIDGET,
};

const mockProps2: WidgetProps = {
  onFocus: mockOnFocus,
  onBlur: mockOnBlur,
  onChange: mockOnChange,
  registry: {} as Registry,
  ...MOCK_FILE_SELECT_WIDGET,
};

describe('Test PasswordWidget Component', () => {
  it('Should render select component', async () => {
    render(<PasswordWidget {...mockProps} />);

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/password'
    );
    const FileUploadWidget = screen.queryByText('FileUploadWidget');

    expect(passwordInput).toBeInTheDocument();
    expect(FileUploadWidget).not.toBeInTheDocument();
  });

  it('Should be disabled', async () => {
    render(<PasswordWidget {...mockProps} disabled />);

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/password'
    );

    expect(passwordInput).toBeDisabled();
  });

  it('Should call onFocus', async () => {
    render(<PasswordWidget {...mockProps} />);

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/password'
    );

    fireEvent.focus(passwordInput);

    expect(mockOnFocus).toHaveBeenCalled();
  });

  it('Should call onBlur', async () => {
    render(<PasswordWidget {...mockProps} />);

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/password'
    );

    fireEvent.blur(passwordInput);

    expect(mockOnBlur).toHaveBeenCalled();
  });

  it('Should call onChange', async () => {
    render(<PasswordWidget {...mockProps} />);

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/password'
    );

    fireEvent.change(passwordInput, { target: { value: 'password' } });

    expect(mockOnChange).toHaveBeenCalledWith('password');
  });

  it('Should call onChange with asterisk', async () => {
    render(<PasswordWidget {...mockProps} />);

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/password'
    );

    fireEvent.change(passwordInput, { target: { value: '*******' } });

    expect(mockOnChange).toHaveBeenCalledWith('*******');
  });

  it('Should not show password if the value is masked', async () => {
    render(<PasswordWidget {...mockProps} />);

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/password'
    );

    expect(passwordInput).toHaveValue('');
  });

  it('Should render FileWidget and password input if uiFieldType is fileOrInput', async () => {
    render(<PasswordWidget {...mockProps2} />);

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/sslConfig/caCertificate'
    );
    const fileUploadWidget = screen.getByText('FileUploadWidget');

    expect(fileUploadWidget).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();

    // Check if the password input is disabled
    expect(passwordInput).toBeDisabled();

    // Click on the Enter file content radio button
    const enterFileContentRadioButton = screen.getByTestId('radio-file-path');
    fireEvent.click(enterFileContentRadioButton);

    // Check if the password input is enabled
    expect(passwordInput).toBeEnabled();

    // Check if the file upload widget is disabled
    expect(fileUploadWidget).toBeDisabled();
  });

  it('Should render only FileWidget uiFieldType is file', async () => {
    render(
      <PasswordWidget
        {...mockProps2}
        schema={{ ...mockProps2.schema, uiFieldType: 'file' }}
      />
    );

    const passwordInput = screen.queryByTestId(
      'password-input-widget-root/sslConfig/caCertificate'
    );
    const fileUploadWidget = screen.getByText('FileUploadWidget');

    expect(fileUploadWidget).toBeInTheDocument();
    expect(passwordInput).toBeNull();
  });
});
