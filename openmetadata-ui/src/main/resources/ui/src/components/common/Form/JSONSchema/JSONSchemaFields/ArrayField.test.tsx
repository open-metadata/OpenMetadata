/*
 *  Copyright 2025 Collate.
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

import { FieldProps, Registry } from '@rjsf/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MOCK_ARRAY_FIELD } from '../../../../../mocks/Fields.mock';
import ArrayField from './ArrayField';

const mockOnFocus = jest.fn();
const mockOnBlur = jest.fn();
const mockOnChange = jest.fn();

const mockBaseProps = {
  onFocus: mockOnFocus,
  onBlur: mockOnBlur,
  onChange: mockOnChange,
  registry: {} as Registry,
};

const mockArrayFieldProps: FieldProps = {
  ...mockBaseProps,
  ...MOCK_ARRAY_FIELD,
};

describe('Test ArrayField Component', () => {
  it('Should render array field component', async () => {
    render(<ArrayField {...mockArrayFieldProps} />);

    const arrayField = screen.getByTestId('array-field');

    expect(arrayField).toBeInTheDocument();
  });

  it('Should display field title when uniqueItems is not true', () => {
    render(<ArrayField {...mockArrayFieldProps} />);

    expect(screen.getByText('Array Field')).toBeInTheDocument();
  });

  it('Should not display field title when uniqueItems is true', () => {
    render(
      <ArrayField
        {...mockArrayFieldProps}
        schema={{ ...mockArrayFieldProps.schema, uniqueItems: true }}
      />
    );

    expect(screen.queryByText('Array Field')).not.toBeInTheDocument();
  });

  it('Should call handleFocus with correct id when focused', () => {
    render(
      <ArrayField
        {...mockArrayFieldProps}
        formContext={{ handleFocus: mockOnFocus }}
      />
    );

    fireEvent.focus(screen.getByTestId('array-field'));

    expect(mockOnFocus).toHaveBeenCalledWith('root/array-field');
  });

  it('Should call handleBlur with correct id and value when blurred', () => {
    render(
      <ArrayField
        {...mockArrayFieldProps}
        formContext={{ handleBlur: mockOnBlur }}
      />
    );

    fireEvent.blur(screen.getByTestId('array-field'));

    expect(mockOnBlur).toHaveBeenCalledWith(
      'root/array-field',
      mockArrayFieldProps.formData
    );
  });

  it('Should be disabled when disabled prop is true', () => {
    render(<ArrayField {...mockArrayFieldProps} disabled />);

    const selectElement = screen.getByTestId('array-field');

    expect(selectElement).toHaveClass('ant-select-disabled');
  });
});
