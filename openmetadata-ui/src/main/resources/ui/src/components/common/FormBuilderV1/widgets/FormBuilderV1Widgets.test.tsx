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

import { WidgetProps } from '@rjsf/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import CoreCheckboxWidget from './CoreCheckboxWidget';
import CoreInputWidget from './CoreInputWidget';
import CorePasswordWidget from './CorePasswordWidget';
import CoreRadioWidget from './CoreRadioWidget';
import CoreSelectWidget from './CoreSelectWidget';
import CoreTextAreaWidget from './CoreTextAreaWidget';

jest.mock('@untitledui/icons', () => ({
  Eye: () => <span>eye-icon</span>,
  EyeOff: () => <span>eye-off-icon</span>,
  UploadCloud01: () => <span>upload-icon</span>,
}));

jest.mock('react-aria-components', () => ({
  Group: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Input: jest.fn(
    ({
      placeholder,
      ...rest
    }: React.InputHTMLAttributes<HTMLInputElement> & {
      placeholder?: string;
    }) => <input placeholder={placeholder} {...rest} />
  ),
  TextField: jest.fn(
    ({
      children,
      value,
      onChange,
    }: {
      children: React.ReactNode;
      value?: string;
      onChange?: (v: string) => void;
    }) => (
      <div>
        {children}
        <input
          readOnly
          aria-label="hidden value"
          data-testid="hidden-value"
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    )
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const { useState } = jest.requireActual('react') as typeof import('react');

  function MockPasswordInput({
    allowUpload,
    hint,
    isRequired,
    label,
  }: Readonly<{
    allowUpload?: boolean;
    hint?: string;
    isRequired?: boolean;
    label?: string;
  }>) {
    const [showPassword, setShowPassword] = useState(false);
    const [showUpload, setShowUpload] = useState(Boolean(allowUpload));

    if (showUpload) {
      return (
        <div>
          <input aria-label="file input" data-testid="file-input" type="file" />
          <button type="button" onClick={() => setShowUpload(false)}>
            select-radio
          </button>
        </div>
      );
    }

    return (
      <div>
        {label && (
          // eslint-disable-next-line jsx-a11y/label-has-for -- test mock
          <label>
            {label}
            {isRequired ? '*' : ''}
          </label>
        )}
        {hint && <span>{hint}</span>}
        <button type="button" onClick={() => setShowPassword(!showPassword)}>
          {showPassword ? <span>eye-off-icon</span> : <span>eye-icon</span>}
        </button>
      </div>
    );
  }

  return {
    Box: jest.fn(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
    Button: jest.fn(
      ({
        children,
        isDisabled,
        onClick,
      }: {
        children: React.ReactNode;
        isDisabled?: boolean;
        onClick?: () => void;
      }) => (
        <button disabled={isDisabled} type="button" onClick={onClick}>
          {children}
        </button>
      )
    ),
    FileTrigger: jest.fn(
      ({
        children,
        onSelect,
      }: {
        children: React.ReactNode;
        onSelect?: (files: FileList | null) => void;
      }) => (
        <div>
          {children}
          <input
            aria-label="file input"
            data-testid="file-input"
            type="file"
            onChange={(e) => onSelect?.(e.target.files)}
          />
        </div>
      )
    ),
    HintText: jest.fn(
      ({
        children,
        isInvalid,
      }: {
        children: React.ReactNode;
        isInvalid?: boolean;
      }) => <div data-invalid={String(Boolean(isInvalid))}>{children}</div>
    ),
    Label: jest.fn(
      ({
        children,
        isRequired,
      }: {
        children: React.ReactNode;
        isRequired?: boolean;
      }) => (
        <div>
          {children}
          {isRequired ? '*' : ''}
        </div>
      )
    ),
    RadioButton: jest.fn(
      ({
        hint,
        label,
        value,
      }: {
        hint?: string;
        label: string;
        value: string;
      }) => (
        // eslint-disable-next-line jsx-a11y/label-has-for -- test mock
        <label>
          <input aria-label={label} type="radio" value={value} />
          {label}
          {hint ? <span>{hint}</span> : null}
        </label>
      )
    ),
    RadioGroup: jest.fn(
      ({
        children,
        className,
        isDisabled,
        onChange,
      }: {
        children: React.ReactNode;
        className?: string;
        isDisabled?: boolean;
        onChange?: (value: string) => void;
      }) => (
        <div className={className} data-disabled={String(Boolean(isDisabled))}>
          {children}
          <button type="button" onClick={() => onChange?.('2')}>
            select-radio
          </button>
        </div>
      )
    ),
    Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    )),
    Checkbox: jest.fn(
      ({
        hint,
        isDisabled,
        isSelected,
        label,
        onChange,
      }: {
        hint?: string;
        isDisabled?: boolean;
        isSelected?: boolean;
        label?: string;
        onChange?: (value: boolean) => void;
      }) => (
        <button
          data-disabled={String(Boolean(isDisabled))}
          data-selected={String(Boolean(isSelected))}
          type="button"
          onClick={() => onChange?.(!isSelected)}>
          {label}
          {hint ? <span>{hint}</span> : null}
        </button>
      )
    ),
    Input: jest.fn(
      ({
        autoFocus,
        hint,
        id,
        isDisabled,
        isInvalid,
        isRequired,
        label,
        onBlur,
        onChange,
        onFocus,
        placeholder,
        type,
        value,
      }: Record<string, unknown>) => (
        <div>
          {label ? (
            // eslint-disable-next-line jsx-a11y/label-has-for -- test mock
            <label htmlFor={id as string}>{label as string}</label>
          ) : null}
          {hint ? <span>{hint as string}</span> : null}
          <input
            aria-invalid={isInvalid as boolean}
            aria-label={label as string}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- mock passes through the autoFocus prop under test
            autoFocus={autoFocus as boolean}
            data-required={String(Boolean(isRequired))}
            disabled={isDisabled as boolean}
            id={id as string}
            placeholder={placeholder as string}
            type={type as string}
            value={value as string}
            onBlur={() => (onBlur as (() => void) | undefined)?.()}
            onChange={(event) =>
              (onChange as ((v: string) => void) | undefined)?.(
                event.target.value
              )
            }
            onFocus={() => (onFocus as (() => void) | undefined)?.()}
          />
        </div>
      )
    ),
    Select: Object.assign(
      jest.fn(
        ({
          children,
          hint,
          isDisabled,
          isInvalid,
          isRequired,
          items,
          label,
          onSelectionChange,
          placeholder,
          selectedKey,
        }: Record<string, unknown>) => (
          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-for -- test mock */}
            {label ? <label>{label as string}</label> : null}
            {hint ? <span>{hint as string}</span> : null}
            <div
              data-disabled={String(Boolean(isDisabled))}
              data-invalid={String(Boolean(isInvalid))}
              data-required={String(Boolean(isRequired))}>
              {placeholder as string}
            </div>
            <div data-testid="selected-key">{String(selectedKey)}</div>
            <button
              type="button"
              onClick={() =>
                (onSelectionChange as ((v: unknown) => void) | undefined)?.('2')
              }>
              choose-option
            </button>
            <button
              type="button"
              onClick={() =>
                (onSelectionChange as ((v: unknown) => void) | undefined)?.(
                  null
                )
              }>
              clear-option
            </button>
            {(items as Array<Record<string, string>>).map((item) => (
              <div key={item.id}>
                {(
                  children as (item: Record<string, string>) => React.ReactNode
                )(item)}
              </div>
            ))}
          </div>
        )
      ),
      {
        Item: ({ children }: { children: React.ReactNode }) => (
          <span>{children}</span>
        ),
      }
    ),
    TextArea: jest.fn(
      ({
        autoFocus,
        hint,
        isDisabled,
        isInvalid,
        isRequired,
        label,
        onBlur,
        onChange,
        onFocus,
        placeholder,
        rows,
        value,
      }: Record<string, unknown>) => (
        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-for -- test mock */}
          {label ? <label>{label as string}</label> : null}
          {hint ? <span>{hint as string}</span> : null}
          <textarea
            aria-invalid={isInvalid as boolean}
            aria-label={label as string}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- mock passes through the autoFocus prop under test
            autoFocus={autoFocus as boolean}
            data-disabled={String(Boolean(isDisabled))}
            data-required={String(Boolean(isRequired))}
            placeholder={placeholder as string}
            rows={rows as number}
            value={value as string}
            onBlur={() => (onBlur as (() => void) | undefined)?.()}
            onChange={(event) =>
              (onChange as ((v: string) => void) | undefined)?.(
                event.target.value
              )
            }
            onFocus={() => (onFocus as (() => void) | undefined)?.()}
          />
        </div>
      )
    ),
    PasswordInput: jest.fn(MockPasswordInput),
    DEFAULT_CREDENTIAL_FILE_MAX_SIZE: 1024 * 1024,
    getReadableFileSize: (bytes: number) => `${bytes} B`,
    // Behaviour lives in the real component's own suite; this stand-in exposes
    // the props the widget maps so the schema → props contract can be asserted.
    CredentialFileInput: jest.fn(
      ({
        acceptedFileTypes,
        allowManualInput,
        hasStoredValue,
        hint,
        isDisabled,
        isInvalid,
        isReadOnly,
        isRequired,
        label,
        validationMessages,
        value,
        onChange,
      }: Record<string, unknown>) => (
        <div data-testid="credential-file-input">
          <span data-testid="cfi-label">{label as string}</span>
          <span data-testid="cfi-hint">{hint as string}</span>
          <span data-testid="cfi-accepted">
            {(acceptedFileTypes as string[] | undefined)?.join(',') ?? ''}
          </span>
          <span data-testid="cfi-manual-input">
            {String(Boolean(allowManualInput))}
          </span>
          <span data-testid="cfi-stored">
            {String(Boolean(hasStoredValue))}
          </span>
          <span data-testid="cfi-disabled">{String(Boolean(isDisabled))}</span>
          <span data-testid="cfi-readonly">{String(Boolean(isReadOnly))}</span>
          <span data-testid="cfi-required">{String(Boolean(isRequired))}</span>
          <span data-testid="cfi-invalid">{String(Boolean(isInvalid))}</span>
          <span data-testid="cfi-value">{(value as string) ?? ''}</span>
          <span data-testid="cfi-size-message">
            {(validationMessages as Record<string, string> | undefined)
              ?.sizeLimit ?? ''}
          </span>
          <button
            type="button"
            onClick={() =>
              (onChange as (v?: string) => void)('-----BEGIN KEY-----')
            }>
            emit-content
          </button>
          <button
            type="button"
            onClick={() => (onChange as (v?: string) => void)(undefined)}>
            emit-clear
          </button>
        </div>
      )
    ),
  };
});

describe('FormBuilderV1 widgets', () => {
  const widgetBaseProps = {
    disabled: false,
    hideLabel: false,
    id: 'widget-id',
    label: 'Widget label',
    name: 'widget-name',
    onBlur: jest.fn(),
    onChange: jest.fn(),
    onFocus: jest.fn(),
    options: {},
    readonly: false,
    registry: {} as WidgetProps['registry'],
    required: false,
    schema: { type: 'string' as const },
  } as unknown as WidgetProps;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles text and numeric input values', () => {
    const onChange = jest.fn();
    const onBlur = jest.fn();
    const onFocus = jest.fn();
    const { rerender } = render(
      <CoreInputWidget
        {...widgetBaseProps}
        autofocus
        required
        options={{ help: 'Helpful hint' }}
        placeholder="Enter text"
        rawErrors={['Invalid']}
        value="abc"
        onBlur={onBlur}
        onChange={onChange}
        onFocus={onFocus}
      />
    );

    const textInput = screen.getByPlaceholderText('Enter text');

    fireEvent.focus(textInput);
    fireEvent.change(textInput, { target: { value: 'next' } });
    fireEvent.change(textInput, { target: { value: '' } });
    fireEvent.blur(textInput);

    expect(screen.getByText('Widget label')).toBeInTheDocument();
    expect(screen.getByText('Invalid')).toBeInTheDocument();
    expect(onFocus).toHaveBeenCalledWith('widget-id', 'abc');
    expect(onChange).toHaveBeenCalledWith('next');
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    expect(onBlur).toHaveBeenCalledWith('widget-id', 'abc');

    rerender(
      <CoreInputWidget
        {...widgetBaseProps}
        options={{ emptyValue: null }}
        schema={{ type: 'integer' as const }}
        value={3}
        onBlur={onBlur}
        onChange={onChange}
        onFocus={onFocus}
      />
    );

    const numberInput = screen.getByRole('spinbutton');

    fireEvent.change(numberInput, { target: { value: '42' } });
    fireEvent.change(numberInput, { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith(42);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('maps select keys back to enum values and supports clearing', () => {
    const onChange = jest.fn();

    render(
      <CoreSelectWidget
        {...widgetBaseProps}
        required
        options={{
          emptyValue: null,
          enumOptions: [
            { label: 'One', value: 1 },
            { label: 'Two', value: 2 },
          ],
        }}
        placeholder="Pick one"
        rawErrors={['Required']}
        value={1}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Widget label')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByTestId('selected-key')).toHaveTextContent('1');
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'choose-option' }));
    fireEvent.click(screen.getByRole('button', { name: 'clear-option' }));

    expect(onChange).toHaveBeenCalledWith(2);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('renders radio options with label and hint and returns raw option values', () => {
    const onChange = jest.fn();

    render(
      <CoreRadioWidget
        {...widgetBaseProps}
        required
        options={{
          inline: true,
          enumOptions: [
            {
              label: 'One',
              schema: { description: 'First option' },
              value: 1,
            },
            {
              label: 'Two',
              value: 2,
            },
          ],
        }}
        rawErrors={['Choose one']}
        value={1}
        onChange={onChange}
      />
    );

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName.toLowerCase() === 'div' &&
          element.textContent?.replace(/\s/g, '') === 'Widgetlabel*'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('First option')).toBeInTheDocument();
    expect(screen.getByText('Choose one')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'select-radio' }));

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('renders checkbox label and toggles boolean state', () => {
    const onChange = jest.fn();

    render(
      <CoreCheckboxWidget
        {...widgetBaseProps}
        value
        options={{ help: 'Checkbox hint' }}
        onChange={onChange}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Widget label Checkbox hint' })
    );

    expect(screen.getByText('Checkbox hint')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('renders textarea props and forwards events', () => {
    const onBlur = jest.fn();
    const onChange = jest.fn();
    const onFocus = jest.fn();

    render(
      <CoreTextAreaWidget
        {...widgetBaseProps}
        autofocus
        required
        options={{ rows: 7 }}
        placeholder="Describe it"
        rawErrors={['Too short']}
        value="hello"
        onBlur={onBlur}
        onChange={onChange}
        onFocus={onFocus}
      />
    );

    const textArea = screen.getByPlaceholderText('Describe it');

    fireEvent.focus(textArea);
    fireEvent.change(textArea, { target: { value: 'updated text' } });
    fireEvent.change(textArea, { target: { value: '' } });
    fireEvent.blur(textArea);

    expect(textArea).toHaveAttribute('rows', '7');
    expect(screen.getByText('Too short')).toBeInTheDocument();
    expect(onFocus).toHaveBeenCalledWith('widget-id', 'hello');
    expect(onChange).toHaveBeenCalledWith('updated text');
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    expect(onBlur).toHaveBeenCalledWith('widget-id', 'hello');
  });

  it('renders password widget default mode with show/hide toggle', () => {
    const onChange = jest.fn();
    const onBlur = jest.fn();
    const onFocus = jest.fn();

    render(
      <CorePasswordWidget
        {...widgetBaseProps}
        required
        placeholder="Enter password"
        rawErrors={['Too short']}
        value="secret"
        onBlur={onBlur}
        onChange={onChange}
        onFocus={onFocus}
      />
    );

    expect(screen.getByText('eye-icon')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('eye-off-icon')).toBeInTheDocument();
  });

  describe('credential-file fields', () => {
    const renderCredentialWidget = (
      uiFieldType: string,
      overrides: Partial<WidgetProps> = {},
      schemaExtras: Record<string, unknown> = {}
    ) =>
      render(
        <CorePasswordWidget
          {...widgetBaseProps}
          schema={{ type: 'string' as const, uiFieldType, ...schemaExtras }}
          value={undefined}
          onChange={jest.fn()}
          {...overrides}
        />
      );

    it('makes a "file" field upload-only', () => {
      renderCredentialWidget('file');

      expect(screen.getByTestId('credential-file-input')).toBeInTheDocument();
      expect(screen.getByTestId('cfi-manual-input')).toHaveTextContent('false');
    });

    it('lets a "fileOrInput" field also accept pasted content', () => {
      renderCredentialWidget('fileOrInput');

      expect(screen.getByTestId('cfi-manual-input')).toHaveTextContent('true');
    });

    it('forwards the schema accept list to the picker', () => {
      renderCredentialWidget('fileOrInput', {}, { accept: ['.pem', '.key'] });

      expect(screen.getByTestId('cfi-accepted')).toHaveTextContent('.pem,.key');
    });

    it('forwards label, required, disabled, read-only and invalid state', () => {
      renderCredentialWidget('file', {
        disabled: true,
        rawErrors: ['Too short'],
        readonly: true,
        required: true,
      });

      expect(screen.getByTestId('cfi-label')).toHaveTextContent('Widget label');
      expect(screen.getByTestId('cfi-required')).toHaveTextContent('true');
      expect(screen.getByTestId('cfi-disabled')).toHaveTextContent('true');
      expect(screen.getByTestId('cfi-readonly')).toHaveTextContent('true');
      expect(screen.getByTestId('cfi-invalid')).toHaveTextContent('true');
    });

    it('passes a real stored value straight through', () => {
      renderCredentialWidget('file', { value: '-----BEGIN KEY-----' });

      expect(screen.getByTestId('cfi-value')).toHaveTextContent(
        '-----BEGIN KEY-----'
      );
    });

    it('withholds the readback mask but flags that a credential is stored', () => {
      renderCredentialWidget('fileOrInput', { value: '*********' });

      // The mask must not reach the field as if it were the secret, but the
      // field still has to show that one is set — and let it be cleared.
      expect(screen.getByTestId('cfi-value')).toBeEmptyDOMElement();
      expect(screen.getByTestId('cfi-stored')).toHaveTextContent('true');
    });

    it('does not flag a stored credential for a real value', () => {
      renderCredentialWidget('file', { value: '-----BEGIN KEY-----' });

      expect(screen.getByTestId('cfi-stored')).toHaveTextContent('false');
    });

    it('reports the size limit in the rejection message', () => {
      renderCredentialWidget('file');

      expect(screen.getByTestId('cfi-size-message')).toHaveTextContent(
        'message.file-size-exceeded'
      );
    });

    it('submits file content as the field value', () => {
      const onChange = jest.fn();
      renderCredentialWidget('file', { onChange });

      fireEvent.click(screen.getByRole('button', { name: 'emit-content' }));

      expect(onChange).toHaveBeenCalledWith('-----BEGIN KEY-----');
    });

    it('clears the field value when the credential is removed', () => {
      const onChange = jest.fn();
      renderCredentialWidget('file', { onChange });

      fireEvent.click(screen.getByRole('button', { name: 'emit-clear' }));

      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('leaves a plain password field as a password input', () => {
      render(
        <CorePasswordWidget
          {...widgetBaseProps}
          value="secret"
          onChange={jest.fn()}
        />
      );

      expect(
        screen.queryByTestId('credential-file-input')
      ).not.toBeInTheDocument();
      expect(screen.getByText('eye-icon')).toBeInTheDocument();
    });
  });
});
