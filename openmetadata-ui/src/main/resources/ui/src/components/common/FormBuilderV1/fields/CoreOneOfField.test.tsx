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
  Select: Object.assign(
    jest.fn(
      ({
        children,
        items,
        label,
        onSelectionChange,
        selectedKey,
      }: {
        children: (item: { id: string; label: string }) => React.ReactNode;
        items: Array<{ id: string; label: string }>;
        label?: string;
        onSelectionChange: (value: string) => void;
        selectedKey?: string;
      }) => (
        <div>
          {label && <label>{label}</label>}
          <div data-testid="selected-key">{selectedKey}</div>
          {items.map((item) => (
            <button
              data-selected={selectedKey === item.id}
              key={item.id}
              type="button"
              onClick={() => onSelectionChange(item.id)}>
              {children(item)}
            </button>
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

const DEFAULT_SCHEMA = {
  oneOf: [
    { title: 'First', type: 'object' },
    { title: 'Second', type: 'object' },
  ],
  title: 'Type',
};

const getBaseProps = (
  formData: Record<string, unknown>,
  schema: Record<string, unknown> = DEFAULT_SCHEMA,
  uiSchema: Record<string, unknown> = {},
  id = 'root/type'
) =>
  ({
    formData,
    idSchema: { $id: id },
    name: 'type',
    onBlur: jest.fn(),
    onChange: jest.fn(),
    onFocus: jest.fn(),
    registry: {
      fields: {
        SchemaField: ({
          schema,
          uiSchema,
        }: {
          schema: { title?: string };
          uiSchema?: Record<string, unknown>;
        }) => (
          <div
            data-testid="schema-field"
            data-ui-field={String(uiSchema?.['ui:field'] ?? '')}>
            {schema.title}
          </div>
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
    schema,
    uiSchema,
  } as unknown as FieldProps);

describe('CoreOneOfField', () => {
  it('keeps the selected option when form data matches multiple options', () => {
    const formData = {};
    const props = getBaseProps(formData);
    const { rerender } = render(<CoreOneOfField {...props} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Second' }));

    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute(
      'data-selected',
      'true'
    );

    rerender(<CoreOneOfField {...getBaseProps(formData)} />);

    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute(
      'data-selected',
      'true'
    );
  });

  it('does not pass a parent ui field to the selected schema branch', () => {
    render(
      <CoreOneOfField
        {...getBaseProps({}, DEFAULT_SCHEMA, { 'ui:field': 'customOneOf' })}
      />
    );

    expect(screen.getByTestId('schema-field')).toHaveAttribute(
      'data-ui-field',
      ''
    );
  });

  it('keeps sample data storage oneOf choices as a compact select', () => {
    render(
      <CoreOneOfField
        {...getBaseProps(
          {},
          DEFAULT_SCHEMA,
          {},
          'root/sampleDataStorageConfig/config/storageConfig'
        )}
      />
    );

    expect(screen.getByTestId('selected-key')).toHaveTextContent('0');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('renders a single branch without an option select', () => {
    render(
      <CoreOneOfField
        {...getBaseProps(
          {},
          { oneOf: [{ title: 'Only Option', type: 'object' }], title: 'Type' }
        )}
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('schema-field')).toHaveTextContent('Only Option');
  });
});
