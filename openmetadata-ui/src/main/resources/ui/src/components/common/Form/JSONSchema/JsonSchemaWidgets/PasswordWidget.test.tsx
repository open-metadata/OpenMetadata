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

// Behaviour lives in the component's own suite; this stand-in exposes the props
// the widget maps so the schema → props contract can be asserted here.
jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  CredentialFileInput: jest.fn(
    ({
      acceptedFileTypes,
      allowManualInput,
      hasStoredValue,
      isDisabled,
      value,
      onChange,
    }: Record<string, unknown>) => (
      <div data-testid="credential-file-input">
        <span data-testid="cfi-manual-input">
          {String(Boolean(allowManualInput))}
        </span>
        <span data-testid="cfi-accepted">
          {(acceptedFileTypes as string[] | undefined)?.join(',') ?? ''}
        </span>
        <span data-testid="cfi-disabled">{String(Boolean(isDisabled))}</span>
        <span data-testid="cfi-stored">{String(Boolean(hasStoredValue))}</span>
        <span data-testid="cfi-value">{(value as string) ?? ''}</span>
        <button
          type="button"
          onClick={() => (onChange as (v?: string) => void)('CERT-CONTENT')}>
          emit-content
        </button>
      </div>
    )
  ),
}));

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should render select component', async () => {
    render(<PasswordWidget {...mockProps} />);

    expect(
      screen.getByTestId('password-input-widget-root/password')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('credential-file-input')
    ).not.toBeInTheDocument();
  });

  it('Should be disabled', async () => {
    render(<PasswordWidget {...mockProps} disabled />);

    expect(
      screen.getByTestId('password-input-widget-root/password')
    ).toBeDisabled();
  });

  it('Should call onFocus', async () => {
    render(<PasswordWidget {...mockProps} />);

    fireEvent.focus(screen.getByTestId('password-input-widget-root/password'));

    expect(mockOnFocus).toHaveBeenCalled();
  });

  it('Should call onBlur', async () => {
    render(<PasswordWidget {...mockProps} />);

    fireEvent.blur(screen.getByTestId('password-input-widget-root/password'));

    expect(mockOnBlur).toHaveBeenCalled();
  });

  it('Should call onChange', async () => {
    render(<PasswordWidget {...mockProps} />);

    fireEvent.change(
      screen.getByTestId('password-input-widget-root/password'),
      {
        target: { value: 'password' },
      }
    );

    expect(mockOnChange).toHaveBeenCalledWith('password');
  });

  it('Should call onChange with asterisk', async () => {
    render(<PasswordWidget {...mockProps} />);

    fireEvent.change(
      screen.getByTestId('password-input-widget-root/password'),
      {
        target: { value: '*******' },
      }
    );

    expect(mockOnChange).toHaveBeenCalledWith('*******');
  });

  it('Should not show password if the value is masked', async () => {
    render(<PasswordWidget {...mockProps} />);

    expect(
      screen.getByTestId('password-input-widget-root/password')
    ).toHaveValue('');
  });

  it('Should render the credential file input with manual input for fileOrInput', async () => {
    render(<PasswordWidget {...mockProps2} />);

    expect(screen.getByTestId('credential-file-input')).toBeInTheDocument();
    expect(screen.getByTestId('cfi-manual-input')).toHaveTextContent('true');
    expect(screen.getByTestId('cfi-accepted')).toHaveTextContent('.pem');
    expect(
      screen.queryByTestId('password-input-widget-root/sslConfig/caCertificate')
    ).not.toBeInTheDocument();
  });

  it('Should make the credential file input upload-only when uiFieldType is file', async () => {
    render(
      <PasswordWidget
        {...mockProps2}
        schema={{ ...mockProps2.schema, uiFieldType: 'file' }}
      />
    );

    expect(screen.getByTestId('credential-file-input')).toBeInTheDocument();
    expect(screen.getByTestId('cfi-manual-input')).toHaveTextContent('false');
  });

  it('Should forward the disabled state to the credential file input', async () => {
    render(<PasswordWidget {...mockProps2} disabled />);

    expect(screen.getByTestId('cfi-disabled')).toHaveTextContent('true');
  });

  it('Should withhold the readback mask but flag that a credential is stored', async () => {
    render(<PasswordWidget {...mockProps2} value="*********" />);

    expect(screen.getByTestId('cfi-value')).toBeEmptyDOMElement();
    expect(screen.getByTestId('cfi-stored')).toHaveTextContent('true');
  });

  it('Should submit uploaded file content as the field value', async () => {
    render(<PasswordWidget {...mockProps2} />);

    fireEvent.click(screen.getByRole('button', { name: 'emit-content' }));

    expect(mockOnChange).toHaveBeenCalledWith('CERT-CONTENT');
  });
});
