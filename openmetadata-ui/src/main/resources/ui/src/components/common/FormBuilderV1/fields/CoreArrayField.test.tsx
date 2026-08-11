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
import CoreArrayField from './CoreArrayField';

jest.mock('@untitledui/icons', () => ({
  Copy01: () => <span>copy-icon</span>,
  XClose: () => <span>x-icon</span>,
}));

jest.mock('@openmetadata/ui-core-components', () => ({
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
  Tooltip: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
}));

jest.mock('react-aria-components', () => ({
  Input: jest.fn(
    ({
      id,
      placeholder,
      value,
      onBlur,
      onChange,
      onFocus,
      onKeyDown,
    }: React.InputHTMLAttributes<HTMLInputElement>) => (
      <input
        id={id}
        placeholder={placeholder}
        value={value}
        onBlur={onBlur}
        onChange={onChange}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
      />
    )
  ),
}));

jest.mock('../../../../hooks/useClipBoard', () => ({
  useClipboard: jest.fn().mockReturnValue({
    onCopyToClipBoard: jest.fn().mockResolvedValue(undefined),
    onPasteFromClipBoard: jest.fn().mockResolvedValue(null),
    hasCopied: false,
  }),
}));

jest.mock('../../../../utils/CSV/CSV.utils', () => ({
  splitCSV: jest.fn((text: string) => text.split(',')),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

const baseFieldProps = {
  idSchema: { $id: 'root/tags' },
  formData: [],
  disabled: false,
  readonly: false,
  schema: { type: 'array' as const },
  formContext: {},
  onBlur: jest.fn(),
  rawErrors: [],
  label: 'Tags',
  required: false,
  registry: {} as FieldProps['registry'],
  onChange: jest.fn(),
} as unknown as FieldProps;

describe('CoreArrayField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders label and empty input', () => {
    render(<CoreArrayField {...baseFieldProps} />);

    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('adds a tag on Enter key', () => {
    const onChange = jest.fn();

    render(<CoreArrayField {...baseFieldProps} onChange={onChange} />);

    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['hello']);
  });

  it('renders existing tags and removes on click', () => {
    const onChange = jest.fn();

    render(
      <CoreArrayField
        {...baseFieldProps}
        formData={['alpha', 'beta']}
        onChange={onChange}
      />
    );

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', {
      name: 'label.remove-entity',
    });

    fireEvent.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith(['beta']);
  });

  it('shows hint text when there are errors', () => {
    render(
      <CoreArrayField {...baseFieldProps} rawErrors={['Required field']} />
    );

    expect(screen.getByText('Required field')).toBeInTheDocument();
    expect(screen.getByText('Required field')).toHaveAttribute(
      'data-invalid',
      'true'
    );
  });

  it('hides remove buttons when disabled', () => {
    render(<CoreArrayField {...baseFieldProps} disabled formData={['tag1']} />);

    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /label\.remove-entity/ })
    ).not.toBeInTheDocument();
  });

  it('calls formContext.handleFocus on input focus', () => {
    const handleFocus = jest.fn();

    render(
      <CoreArrayField {...baseFieldProps} formContext={{ handleFocus }} />
    );

    fireEvent.focus(screen.getByRole('textbox'));

    expect(handleFocus).toHaveBeenCalledWith('root/tags');
  });

  it('renders copy button', () => {
    render(<CoreArrayField {...baseFieldProps} />);

    expect(screen.getByText('copy-icon')).toBeInTheDocument();
  });
});
