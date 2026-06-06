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
import React from 'react';
import CoreOneOfField from './CoreOneOfField';

jest.mock('@openmetadata/ui-core-components', () => ({
  RadioButton: jest.fn(
    ({
      label,
      onSelect,
      selectedValue,
      value,
    }: {
      label: string;
      onSelect?: (value: string) => void;
      selectedValue?: string;
      value: string;
    }) => (
      <button
        aria-checked={selectedValue === value}
        role="radio"
        type="button"
        onClick={() => onSelect?.(value)}>
        {label}
      </button>
    )
  ),
  RadioGroup: jest.fn(
    ({
      children,
      onChange,
      value,
    }: {
      children: React.ReactElement[];
      onChange: (value: string) => void;
      value: string;
    }) => (
      <div role="radiogroup">
        {children.map((child) =>
          React.cloneElement(child, {
            onSelect: onChange,
            selectedValue: value,
          })
        )}
      </div>
    )
  ),
  Typography: jest.fn(
    ({
      children,
      as: Tag = 'span',
      ...props
    }: {
      children: React.ReactNode;
      as?: React.ElementType;
    }) => <Tag {...props}>{children}</Tag>
  ),
}));

const getBaseProps = (formData: Record<string, unknown>) =>
  ({
    formData,
    idSchema: { $id: 'root/type' },
    name: 'type',
    onBlur: jest.fn(),
    onChange: jest.fn(),
    onFocus: jest.fn(),
    registry: {
      fields: {
        SchemaField: ({ schema }: { schema: { title?: string } }) => (
          <div data-testid="schema-field">{schema.title}</div>
        ),
      },
      schemaUtils: {
        getClosestMatchingOption: (
          data: Record<string, unknown>,
          _options: unknown[],
          selectedOption: number
        ) => (data.type === 'second' ? 1 : selectedOption),
        getDefaultFormState: (
          _schema: unknown,
          data: Record<string, unknown> | undefined
        ) => data ?? {},
        retrieveSchema: (schema: unknown) => schema,
        sanitizeDataForNewSchema: (
          _newSchema: unknown,
          _currentSchema: unknown,
          data: Record<string, unknown>
        ) => data,
        toIdSchema: () => ({ $id: 'root/type' }),
      },
    },
    schema: {
      oneOf: [
        { title: 'First', type: 'object' },
        { title: 'Second', type: 'object' },
      ],
      title: 'Type',
    },
  } as unknown as FieldProps);

describe('CoreOneOfField', () => {
  it('keeps the selected option when form data matches multiple options', () => {
    const formData = {};
    const props = getBaseProps(formData);
    const { rerender } = render(<CoreOneOfField {...props} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Second' }));

    expect(screen.getByRole('radio', { name: 'Second' })).toHaveAttribute(
      'aria-checked',
      'true'
    );

    rerender(<CoreOneOfField {...getBaseProps(formData)} />);

    expect(screen.getByRole('radio', { name: 'Second' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });
});
