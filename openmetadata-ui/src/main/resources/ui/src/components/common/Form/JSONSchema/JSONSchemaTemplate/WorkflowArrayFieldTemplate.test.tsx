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

import { FieldProps, IdSchema, Registry } from '@rjsf/utils';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MOCK_WORKFLOW_ARRAY_FIELD_TEMPLATE } from '../../../../../mocks/Templates.mock';
import WorkflowArrayFieldTemplate from './WorkflowArrayFieldTemplate';

const mockOnFocus = jest.fn();
const mockOnBlur = jest.fn();
const mockOnChange = jest.fn();

const mockBaseProps = {
  onFocus: mockOnFocus,
  onBlur: mockOnBlur,
  onChange: mockOnChange,
  registry: {} as Registry,
};

const mockWorkflowArrayFieldTemplateProps: FieldProps = {
  ...mockBaseProps,
  ...MOCK_WORKFLOW_ARRAY_FIELD_TEMPLATE,
};

describe('Test WorkflowArrayFieldTemplate Component', () => {
  it('Should render workflow array field component', async () => {
    render(
      <WorkflowArrayFieldTemplate {...mockWorkflowArrayFieldTemplateProps} />
    );

    const arrayField = screen.getByTestId('workflow-array-field-template');

    expect(arrayField).toBeInTheDocument();
  });

  it('Should display field title when uniqueItems is not true', () => {
    render(
      <WorkflowArrayFieldTemplate {...mockWorkflowArrayFieldTemplateProps} />
    );

    expect(
      screen.getByText('Workflow Array Field Template')
    ).toBeInTheDocument();
  });

  it('Should not display field title when uniqueItems is true', () => {
    render(
      <WorkflowArrayFieldTemplate
        {...mockWorkflowArrayFieldTemplateProps}
        schema={{
          ...mockWorkflowArrayFieldTemplateProps.schema,
          uniqueItems: true,
        }}
      />
    );

    expect(
      screen.queryByText('Workflow Array Field Template')
    ).not.toBeInTheDocument();
  });

  it('Should call handleFocus with correct id when focused', () => {
    render(
      <WorkflowArrayFieldTemplate
        {...mockWorkflowArrayFieldTemplateProps}
        formContext={{ handleFocus: mockOnFocus }}
      />
    );

    fireEvent.focus(screen.getByTestId('workflow-array-field-template'));

    expect(mockOnFocus).toHaveBeenCalledWith(
      'root/workflow-array-field-template'
    );
  });

  it('Should call handleBlur with correct id and value when blurred', () => {
    render(
      <WorkflowArrayFieldTemplate
        {...mockWorkflowArrayFieldTemplateProps}
        formContext={{ handleBlur: mockOnBlur }}
      />
    );

    fireEvent.blur(screen.getByTestId('workflow-array-field-template'));

    expect(mockOnBlur).toHaveBeenCalledWith(
      'root/workflow-array-field-template',
      mockWorkflowArrayFieldTemplateProps.formData
    );
  });

  it('Should be disabled when disabled prop is true', () => {
    render(
      <WorkflowArrayFieldTemplate
        {...mockWorkflowArrayFieldTemplateProps}
        disabled
      />
    );

    const selectElement = screen.getByTestId('workflow-array-field-template');

    expect(selectElement).toHaveClass('ant-select-disabled');
  });

  it('Should set the filter pattern placeholder only for relevant fields', () => {
    render(
      <WorkflowArrayFieldTemplate
        {...mockWorkflowArrayFieldTemplateProps}
        formData={[]}
        idSchema={{ $id: 'root/schemaFilterPattern/includes' } as IdSchema}
      />
    );

    const placeholderText = screen.getByText(
      'message.filter-pattern-placeholder'
    );

    expect(placeholderText).toBeInTheDocument();
  });

  it('Should not set filter pattern placeholder for other fields', () => {
    render(
      <WorkflowArrayFieldTemplate
        {...mockWorkflowArrayFieldTemplateProps}
        formData={[]}
        idSchema={{ $id: 'root/spaceTypes' } as IdSchema}
      />
    );

    const placeholderText = screen
      .getByTestId('workflow-array-field-template')
      .querySelector('span.ant-select-selection-placeholder');

    expect(placeholderText).toHaveTextContent('');
  });

  it('Should call onChange with correct value when comma seperated values are entered', async () => {
    render(
      <WorkflowArrayFieldTemplate
        {...mockWorkflowArrayFieldTemplateProps}
        formData={[]}
      />
    );

    const select = screen.getByTestId('workflow-array-field-template');
    const input = within(select).getByRole('combobox');

    // Test basic comma-separated values
    fireEvent.change(input, { target: { value: 'value1,value2,value3' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockWorkflowArrayFieldTemplateProps.onChange).toHaveBeenCalledWith([
      'value1',
      'value2',
      'value3',
    ]);

    // Test values with spaces
    fireEvent.change(input, {
      target: { value: 'value 1, value 2 , value 3 ' },
    });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockWorkflowArrayFieldTemplateProps.onChange).toHaveBeenCalledWith([
      'value 1',
      'value 2',
      'value 3',
    ]);

    // Test empty values
    fireEvent.change(input, { target: { value: 'value1,,value3' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockWorkflowArrayFieldTemplateProps.onChange).toHaveBeenCalledWith([
      'value1',
      '',
      'value3',
    ]);

    // Test value with comma
    fireEvent.change(input, { target: { value: 'value1,"value,e3"' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockWorkflowArrayFieldTemplateProps.onChange).toHaveBeenCalledWith([
      'value1',
      'value,e3',
    ]);

    // Test value which has double quotes in the middle
    fireEvent.change(input, { target: { value: `Test1,"random,\\"abc\\""` } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockWorkflowArrayFieldTemplateProps.onChange).toHaveBeenCalledWith([
      'Test1',
      'random,"abc"',
    ]);
  });
});
