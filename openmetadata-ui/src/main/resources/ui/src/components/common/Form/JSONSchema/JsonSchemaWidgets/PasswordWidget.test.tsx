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

const mockPropsUnmasked: WidgetProps = {
  onFocus: mockOnFocus,
  onBlur: mockOnBlur,
  onChange: mockOnChange,
  registry: {} as Registry,
  ...MOCK_PASSWORD_WIDGET,
  value: 'my-plain-password',
};

const mockProps2: WidgetProps = {
  onFocus: mockOnFocus,
  onBlur: mockOnBlur,
  onChange: mockOnChange,
  registry: {} as Registry,
  ...MOCK_FILE_SELECT_WIDGET,
};

describe('Test PasswordWidget Component', () => {
  it('Should show saved indicator when value is masked', async () => {
    render(<PasswordWidget {...mockProps} />);

    expect(
      screen.getByTestId('password-update-btn-root/password')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('password-input-widget-root/password')
    ).not.toBeInTheDocument();
  });

  it('Should show remove button when field is not required and value is masked', async () => {
    render(<PasswordWidget {...mockProps} required={false} />);

    expect(
      screen.getByTestId('password-remove-btn-root/password')
    ).toBeInTheDocument();
  });

  it('Should not show remove button when field is required', async () => {
    render(<PasswordWidget {...mockProps} required />);

    expect(
      screen.queryByTestId('password-remove-btn-root/password')
    ).not.toBeInTheDocument();
  });

  it('Should show password input after clicking Update', async () => {
    render(<PasswordWidget {...mockProps} />);

    fireEvent.click(screen.getByTestId('password-update-btn-root/password'));

    expect(
      screen.getByTestId('password-input-widget-root/password')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('password-cancel-edit-btn-root/password')
    ).toBeInTheDocument();
  });

  it('Should return to saved indicator after clicking Cancel', async () => {
    render(<PasswordWidget {...mockProps} />);

    fireEvent.click(screen.getByTestId('password-update-btn-root/password'));
    fireEvent.click(
      screen.getByTestId('password-cancel-edit-btn-root/password')
    );

    expect(
      screen.getByTestId('password-update-btn-root/password')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('password-input-widget-root/password')
    ).not.toBeInTheDocument();
  });

  it('Should call onChange with empty string when Remove is clicked', async () => {
    render(<PasswordWidget {...mockProps} required={false} />);

    fireEvent.click(screen.getByTestId('password-remove-btn-root/password'));

    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('Should be disabled after clicking Update and field is disabled', async () => {
    render(<PasswordWidget {...mockProps} disabled />);

    fireEvent.click(screen.getByTestId('password-update-btn-root/password'));

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/password'
    );

    expect(passwordInput).toBeDisabled();
  });

  it('Should render password input directly when value is not masked', async () => {
    render(<PasswordWidget {...mockPropsUnmasked} />);

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/password'
    );

    expect(passwordInput).toBeInTheDocument();
    expect(
      screen.queryByTestId('password-update-btn-root/password')
    ).not.toBeInTheDocument();
  });

  it('Should call onChange after clicking Update and typing', async () => {
    render(<PasswordWidget {...mockProps} />);

    fireEvent.click(screen.getByTestId('password-update-btn-root/password'));

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/password'
    );
    fireEvent.change(passwordInput, { target: { value: 'newpassword' } });

    expect(mockOnChange).toHaveBeenCalledWith('newpassword');
  });

  it('Should call onFocus after clicking Update', async () => {
    render(<PasswordWidget {...mockProps} />);

    fireEvent.click(screen.getByTestId('password-update-btn-root/password'));

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/password'
    );
    fireEvent.focus(passwordInput);

    expect(mockOnFocus).toHaveBeenCalled();
  });

  it('Should call onBlur after clicking Update', async () => {
    render(<PasswordWidget {...mockProps} />);

    fireEvent.click(screen.getByTestId('password-update-btn-root/password'));

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/password'
    );
    fireEvent.blur(passwordInput);

    expect(mockOnBlur).toHaveBeenCalled();
  });

  it('Should render FileWidget and password input if uiFieldType is fileOrInput', async () => {
    render(<PasswordWidget {...mockProps2} />);

    const passwordInput = screen.getByTestId(
      'password-input-widget-root/sslConfig/caCertificate'
    );
    const fileUploadWidget = screen.getByText('FileUploadWidget');

    expect(fileUploadWidget).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();

    expect(passwordInput).toBeDisabled();

    const enterFileContentRadioButton = screen.getByTestId('radio-file-path');
    fireEvent.click(enterFileContentRadioButton);

    expect(passwordInput).toBeEnabled();
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
