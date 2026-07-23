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

import { FieldProps, UiSchema } from '@rjsf/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import LayoutGridField from './LayoutGridField';

const mockSchemaField = jest.fn();

describe('LayoutGridField', () => {
  const baseProps = {
    name: 'root',
    schema: {
      type: 'object' as const,
      properties: {
        firstName: { type: 'string' as const },
        lastName: { type: 'string' as const },
        age: { type: 'integer' as const },
      },
      required: ['firstName'],
    },
    uiSchema: {
      firstName: { 'ui:placeholder': 'First name' },
      'ui:options': {
        className: 'grid-wrapper',
        rowClassName: 'default-row',
        rows: [
          {
            className: 'identity-row',
            columns: [
              {
                className: 'first-column',
                name: 'firstName',
                uiSchema: { 'ui:widget': 'text' },
              },
              {
                name: 'lastName',
              },
            ],
          },
        ],
        unplacedFieldsClassName: 'unplaced-fields',
      },
    },
    formData: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      age: 36,
    },
    errorSchema: {
      firstName: { __errors: ['Required'] },
    },
    idSchema: {
      $id: 'root',
      firstName: { $id: 'root_firstName' },
      lastName: { $id: 'root_lastName' },
      age: { $id: 'root_age' },
    },
    registry: {
      fields: {
        SchemaField: (props: Record<string, unknown>) => {
          mockSchemaField(props);

          return (
            <div data-testid={`field-${props.name as string}`}>
              <span>{props.name as string}</span>
              <span>{JSON.stringify(props.uiSchema)}</span>
              <button
                type="button"
                onClick={() =>
                  (
                    props.onChange as (
                      value: unknown,
                      errorSchemaValue?: unknown,
                      fieldId?: string
                    ) => void
                  )('updated', { __errors: [] }, `${props.name}-id`)
                }>
                update-{props.name as string}
              </button>
            </div>
          );
        },
      },
      formContext: {},
      globalUiOptions: {},
      schemaUtils: {
        retrieveSchema: jest.fn((schema) => schema),
      },
    },
    disabled: false,
    readonly: false,
    hideError: false,
    idPrefix: 'root',
    idSeparator: '/',
    onBlur: jest.fn(),
    onFocus: jest.fn(),
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders configured rows and remaining unplaced fields', () => {
    const { container } = render(
      <LayoutGridField {...(baseProps as unknown as FieldProps)} />
    );

    expect(container.firstChild).toHaveClass('grid-wrapper');
    expect(screen.getByTestId('field-firstName')).toBeInTheDocument();
    expect(screen.getByTestId('field-lastName')).toBeInTheDocument();
    expect(screen.getByTestId('field-age')).toBeInTheDocument();
    expect(container.querySelector('.identity-row')).toBeInTheDocument();
    expect(container.querySelector('.unplaced-fields')).toBeInTheDocument();

    const firstFieldProps = mockSchemaField.mock.calls[0][0];

    expect(firstFieldProps.required).toBe(true);
    expect(firstFieldProps.uiSchema).toEqual({
      'ui:placeholder': 'First name',
      'ui:widget': 'text',
    });
  });

  it('merges field changes back into the parent form data', () => {
    render(<LayoutGridField {...(baseProps as unknown as FieldProps)} />);

    fireEvent.click(screen.getByRole('button', { name: 'update-firstName' }));

    expect(baseProps.onChange).toHaveBeenCalledWith(
      {
        firstName: 'updated',
        lastName: 'Lovelace',
        age: 36,
      },
      { __errors: [] },
      'firstName-id'
    );
  });

  it('skips fields without a schema or id entry', () => {
    render(
      <LayoutGridField
        {...(baseProps as unknown as FieldProps)}
        idSchema={{
          $id: 'root',
          firstName: { $id: 'root_firstName' },
        }}
        schema={{
          type: 'object' as const,
          properties: {
            firstName: { type: 'string' as const },
          },
        }}
        uiSchema={
          {
            'ui:options': {
              rows: [
                {
                  columns: [{ name: 'missing' }, { name: 'firstName' }],
                },
              ],
            },
          } as unknown as UiSchema
        }
      />
    );

    expect(screen.getByTestId('field-firstName')).toBeInTheDocument();
    expect(screen.queryByTestId('field-missing')).not.toBeInTheDocument();
  });
});
