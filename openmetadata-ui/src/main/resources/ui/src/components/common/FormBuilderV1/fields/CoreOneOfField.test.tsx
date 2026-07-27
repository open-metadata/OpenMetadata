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
  Box: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Select: Object.assign(
    jest.fn(
      ({
        children,
        items,
        label,
        onSelectionChange,
        selectedKey,
      }: {
        children: (item: {
          icon?: React.ReactNode;
          id: string;
          label: string;
        }) => React.ReactNode;
        items: Array<{ icon?: React.ReactNode; id: string; label: string }>;
        label?: string;
        onSelectionChange: (value: string | null) => void;
        selectedKey?: string;
      }) => (
        <div>
          {label && <label>{label}</label>}
          <div data-testid="selected-key">{selectedKey}</div>
          <button
            data-testid="clear-selection"
            type="button"
            onClick={() => onSelectionChange(null)}>
            Clear
          </button>
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
      Item: ({
        children,
        icon,
      }: {
        children: React.ReactNode;
        icon?: React.ReactNode;
      }) => (
        <span>
          {icon}
          {children}
        </span>
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
          hideLabel,
          schema,
          uiSchema,
        }: {
          hideLabel?: boolean;
          schema: { title?: string };
          uiSchema?: Record<string, unknown>;
        }) => (
          <div
            data-hide-label={String(Boolean(hideLabel))}
            data-testid="schema-field"
            data-ui-field={String(uiSchema?.['ui:field'] ?? '')}
            data-ui-label={String(uiSchema?.['ui:label'] ?? '')}>
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

  it('renders no selected branch for an empty oneOf schema', () => {
    render(
      <CoreOneOfField
        {...getBaseProps({}, { oneOf: [], title: 'Type' }, {}, 'root/type')}
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('schema-field')).toBeEmptyDOMElement();
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

  it('keeps selectors with four or more branches as a compact select', () => {
    render(
      <CoreOneOfField
        {...getBaseProps(
          {},
          {
            oneOf: [
              { title: 'First', type: 'object' },
              { title: 'Second', type: 'object' },
              { title: 'Third', type: 'object' },
              { title: 'Fourth', type: 'object' },
            ],
            title: 'Type',
          }
        )}
      />
    );

    expect(screen.getByTestId('selected-key')).toHaveTextContent('0');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('keeps source selectors as a compact select', () => {
    render(
      <CoreOneOfField
        {...getBaseProps({}, DEFAULT_SCHEMA, {}, 'root/configSource')}
      />
    );

    expect(screen.getByTestId('selected-key')).toHaveTextContent('0');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('preserves connector acronyms in option labels', () => {
    render(
      <CoreOneOfField
        {...getBaseProps(
          {},
          {
            oneOf: [
              { title: 'S3Config', type: 'object' },
              { title: 'gcsConfig', type: 'object' },
            ],
            title: 'Storage Config',
          },
          {},
          'root/sampleDataStorageConfig/config/storageConfig'
        )}
      />
    );

    expect(
      screen.getByRole('button', { name: 'S3 Config' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'GCS Config' })
    ).toBeInTheDocument();
    expect(screen.queryByText('S 3 Config')).not.toBeInTheDocument();
  });

  it('shows the storage config icon for AWS S3 config choices', () => {
    render(
      <CoreOneOfField
        {...getBaseProps(
          {},
          {
            oneOf: [
              { title: 'AWS S3 Storage Config', type: 'object' },
              { title: 'GCS Config', type: 'object' },
            ],
            title: 'Storage Config',
          },
          {},
          'root/sampleDataStorageConfig/config/storageConfig'
        )}
      />
    );

    expect(screen.getByTestId('storage-config-title-icon')).toBeInTheDocument();
  });

  it('ignores no-op and null compact selector changes', () => {
    const onChange = jest.fn();

    render(
      <CoreOneOfField
        {...{
          ...getBaseProps(
            {},
            {
              oneOf: [
                { title: 'First Option With Long Label', type: 'object' },
                { title: 'Second Option With Long Label', type: 'object' },
              ],
              title: 'Type',
            }
          ),
          onChange,
        }}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'First Option With Long Label' })
    );
    fireEvent.click(screen.getByTestId('clear-selection'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps nested project ID selectors as a compact select', () => {
    const { container } = render(
      <CoreOneOfField
        {...getBaseProps(
          {},
          {
            oneOf: [
              { title: 'Single Project ID', type: 'string' },
              {
                items: { type: 'string' },
                title: 'Multiple Project ID',
                type: 'array',
              },
            ],
            title: 'Project ID',
          },
          {},
          'root/credentials/gcpConfig/projectId'
        )}
      />
    );

    expect(screen.getByTestId('selected-key')).toHaveTextContent('0');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(container.querySelector('.core-one-of-field')).toHaveClass(
      'core-one-of-field-inline-selected'
    );
    expect(screen.getByTestId('schema-field')).toHaveTextContent(
      'Single Project ID'
    );
    expect(screen.getByTestId('schema-field')).toHaveAttribute(
      'data-ui-label',
      ''
    );
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
