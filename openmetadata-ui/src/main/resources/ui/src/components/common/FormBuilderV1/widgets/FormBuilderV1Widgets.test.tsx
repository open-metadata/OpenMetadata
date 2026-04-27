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
import CoreRadioWidget from './CoreRadioWidget';
import CoreSelectWidget from './CoreSelectWidget';
import CoreTextAreaWidget from './CoreTextAreaWidget';

jest.mock('@openmetadata/ui-core-components', () => ({
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
  HintText: jest.fn(
    ({
      children,
      isInvalid,
    }: {
      children: React.ReactNode;
      isInvalid?: boolean;
    }) => <div data-invalid={String(Boolean(isInvalid))}>{children}</div>
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
        {label ? <label htmlFor={id as string}>{label as string}</label> : null}
        {hint ? <span>{hint as string}</span> : null}
        <input
          aria-invalid={isInvalid as boolean}
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
      <label>
        <input type="radio" value={value} />
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
              (onSelectionChange as ((v: unknown) => void) | undefined)?.(null)
            }>
            clear-option
          </button>
          {(items as Array<Record<string, string>>).map((item) => (
            <div key={item.id}>
              {(children as (item: Record<string, string>) => React.ReactNode)(
                item
              )}
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
        {label ? <label>{label as string}</label> : null}
        {hint ? <span>{hint as string}</span> : null}
        <textarea
          aria-invalid={isInvalid as boolean}
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
}));

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
    fireEvent.blur(textInput);

    expect(screen.getByText('Widget label')).toBeInTheDocument();
    expect(screen.getByText('Invalid')).toBeInTheDocument();
    expect(onFocus).toHaveBeenCalledWith('widget-id', 'abc');
    expect(onChange).toHaveBeenCalledWith('next');
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

    expect(screen.getByText('Widget label*')).toBeInTheDocument();
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
    fireEvent.blur(textArea);

    expect(textArea).toHaveAttribute('rows', '7');
    expect(screen.getByText('Too short')).toBeInTheDocument();
    expect(onFocus).toHaveBeenCalledWith('widget-id', 'hello');
    expect(onChange).toHaveBeenCalledWith('updated text');
    expect(onBlur).toHaveBeenCalledWith('widget-id', 'hello');
  });
});
