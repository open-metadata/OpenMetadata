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

import { FieldProps } from '@rjsf/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import CoreBooleanField from './CoreBooleanField';

jest.mock('@openmetadata/ui-core-components', () => ({
  Toggle: jest.fn(
    ({
      isDisabled,
      isSelected,
      label,
      onChange,
    }: {
      isDisabled?: boolean;
      isSelected?: boolean;
      label?: string;
      onChange?: (value: boolean) => void;
    }) => (
      <button
        aria-label={label}
        data-disabled={String(Boolean(isDisabled))}
        data-selected={String(Boolean(isSelected))}
        type="button"
        onClick={() => onChange?.(!isSelected)}>
        {label}
      </button>
    )
  ),
}));

const baseProps = {
  disabled: false,
  readonly: false,
  formData: false,
  name: 'enableDebugLog',
  schema: { title: 'Enable Debug Log', type: 'boolean' as const },
  idSchema: { $id: 'root/enableDebugLog' },
  formContext: {},
  onChange: jest.fn(),
  registry: {} as FieldProps['registry'],
} as unknown as FieldProps;

describe('CoreBooleanField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with schema title as label', () => {
    render(<CoreBooleanField {...baseProps} />);

    expect(screen.getByText('Enable Debug Log')).toBeInTheDocument();
  });

  it('uses startCase of name when schema has no title', () => {
    render(
      <CoreBooleanField {...baseProps} schema={{ type: 'boolean' as const }} />
    );

    expect(screen.getByText('Enable Debug Log')).toBeInTheDocument();
  });

  it('calls onChange and formContext.handleFocus when toggled', () => {
    const onChange = jest.fn();
    const handleFocus = jest.fn();

    render(
      <CoreBooleanField
        {...baseProps}
        formContext={{ handleFocus }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    expect(handleFocus).toHaveBeenCalledWith('root/enableDebugLog');
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reflects formData as isSelected', () => {
    render(<CoreBooleanField {...baseProps} formData />);

    expect(screen.getByRole('button')).toHaveAttribute('data-selected', 'true');
  });

  it('passes disabled state when disabled prop is true', () => {
    render(<CoreBooleanField {...baseProps} disabled />);

    expect(screen.getByRole('button')).toHaveAttribute('data-disabled', 'true');
  });

  it('passes disabled state when readonly prop is true', () => {
    render(<CoreBooleanField {...baseProps} readonly />);

    expect(screen.getByRole('button')).toHaveAttribute('data-disabled', 'true');
  });
});
