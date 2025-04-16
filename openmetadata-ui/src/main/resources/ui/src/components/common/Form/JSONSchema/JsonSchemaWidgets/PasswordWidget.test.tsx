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
  jest.fn().mockReturnValue(<p>FileUploadWidget</p>)
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

    const passwordInput = screen.getByTestId('password-input-widget');
    const FileUploadWidget = screen.queryByText('FileUploadWidget');

    expect(passwordInput).toBeInTheDocument();
    expect(FileUploadWidget).not.toBeInTheDocument();
  });

  it('Should be disabled', async () => {
    render(<PasswordWidget {...mockProps} disabled />);

    const passwordInput = screen.getByTestId('password-input-widget');

    expect(passwordInput).toBeDisabled();
  });

  it('Should call onFocus', async () => {
    render(<PasswordWidget {...mockProps} />);

    const passwordInput = screen.getByTestId('password-input-widget');

    fireEvent.focus(passwordInput);

    expect(mockOnFocus).toHaveBeenCalled();
  });

  it('Should call onBlur', async () => {
    render(<PasswordWidget {...mockProps} />);

    const passwordInput = screen.getByTestId('password-input-widget');

    fireEvent.blur(passwordInput);

    expect(mockOnBlur).toHaveBeenCalled();
  });

  it('Should call onChange', async () => {
    render(<PasswordWidget {...mockProps} />);

    const passwordInput = screen.getByTestId('password-input-widget');

    fireEvent.change(passwordInput, { target: { value: 'password' } });

    expect(mockOnChange).toHaveBeenCalledWith('password');
  });

  it('Should call onChange with asterisk', async () => {
    render(<PasswordWidget {...mockProps} />);

    const passwordInput = screen.getByTestId('password-input-widget');

    fireEvent.change(passwordInput, { target: { value: '*******' } });

    expect(mockOnChange).toHaveBeenCalledWith('*******');
  });

  it('Should not show password if the value is masked', async () => {
    render(<PasswordWidget {...mockProps} />);

    const passwordInput = screen.getByTestId('password-input-widget');

    expect(passwordInput).toHaveValue('');
  });

  it('Should render FileWidget component if uiFieldType is file', async () => {
    render(<PasswordWidget {...mockProps2} />);

    const passwordInput = screen.queryByTestId('password-input-widget');
    const fileUploadWidget = screen.getByText('FileUploadWidget');

    expect(fileUploadWidget).toBeInTheDocument();
    expect(passwordInput).not.toBeInTheDocument();
  });
});
