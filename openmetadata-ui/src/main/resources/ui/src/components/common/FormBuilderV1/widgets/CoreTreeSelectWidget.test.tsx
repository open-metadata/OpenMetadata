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
import Form from '@rjsf/core';
import { RJSFSchema, WidgetProps } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import CoreArrayField from '../fields/CoreArrayField';
import CoreSelectWidget from './CoreSelectWidget';

const ENUM = ['all', 'table', 'tableColumn', 'dashboard'];

const renderWidget = (props: Partial<WidgetProps> = {}) => {
  const onChange = jest.fn();
  render(
    <CoreSelectWidget
      id="root/entities"
      label="Entities"
      name="entities"
      options={{ enumOptions: ENUM.map((value) => ({ label: value, value })) }}
      registry={{} as WidgetProps['registry']}
      schema={{ type: 'array', uiFieldType: 'treeSelect' }}
      value={[]}
      onBlur={jest.fn()}
      onChange={onChange}
      onFocus={jest.fn()}
      {...props}
    />
  );

  return onChange;
};

const openTree = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('tree-select-widget'));
  });

  return screen.findByTestId('tree-node-all');
};

const clickNode = async (id: string) => {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`tree-node-${id}`));
  });
};

describe('CoreTreeSelectWidget', () => {
  it('renders treeSelect fields as an "All" parent over every enum value but the sentinel', async () => {
    renderWidget();

    await openTree();

    expect(screen.getByTestId('tree-node-table')).toHaveTextContent('Table');
    expect(screen.getByTestId('tree-node-tableColumn')).toHaveTextContent(
      'Table Column'
    );
    expect(screen.queryAllByTestId('tree-node-all')).toHaveLength(1);
  });

  it('reports focus when the tree opens, so the doc panel can follow', async () => {
    const onFocus = jest.fn();
    renderWidget({ onFocus });

    await openTree();

    expect(onFocus).toHaveBeenCalledWith('root/entities', []);
  });

  it('stores a partial selection as the picked values', async () => {
    const onChange = renderWidget();

    await openTree();
    await clickNode('table');

    expect(onChange).toHaveBeenLastCalledWith(['table']);
  });

  it('collapses a fully checked tree to the "all" sentinel', async () => {
    const onChange = renderWidget();

    await openTree();
    await clickNode('all');

    expect(onChange).toHaveBeenLastCalledWith(['all']);
  });

  it('expands "all" to every enum value when the schema sets expandAllValue', async () => {
    const onChange = renderWidget({
      options: {
        enumOptions: ['created', 'updated'].map((value) => ({
          label: value,
          value,
        })),
      },
      schema: {
        type: 'array',
        uiFieldType: 'treeSelect',
        expandAllValue: true,
      },
    });

    await openTree();
    await clickNode('all');

    expect(onChange).toHaveBeenLastCalledWith(['created', 'updated']);
  });

  it('drops one value out of a stored "all" selection', async () => {
    const onChange = renderWidget({ value: ['all'] });

    await openTree();
    await clickNode('table');

    expect(onChange).toHaveBeenLastCalledWith(['tableColumn', 'dashboard']);
  });

  it('shows a single "All" chip for a stored "all" selection, and clears it on remove', async () => {
    const onChange = renderWidget({ value: ['all'] });

    expect(
      await screen.findByTestId('tree-select-widget-chip-all')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('tree-select-widget-chip-table')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'label.remove-entity' })
    );

    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('removes just the clicked value from a partial selection', async () => {
    const onChange = renderWidget({ value: ['table', 'dashboard'] });

    await screen.findByTestId('tree-select-widget-chip-table');
    fireEvent.click(
      within(screen.getByTestId('tree-select-widget-chip-table')).getByRole(
        'button'
      )
    );

    expect(onChange).toHaveBeenLastCalledWith(['dashboard']);
  });

  it('renders a treeSelect array as the tree instead of free-form tags inside a form', async () => {
    render(
      <Form
        fields={{ ArrayField: CoreArrayField }}
        formData={{ entities: ['all'] }}
        schema={
          {
            type: 'object',
            properties: {
              entities: {
                type: 'array',
                uiFieldType: 'treeSelect',
                uniqueItems: true,
                items: { type: 'string', enum: ENUM },
              },
            },
          } as RJSFSchema
        }
        validator={validator}
        widgets={{ SelectWidget: CoreSelectWidget }}
      />
    );

    expect(await openTree()).toBeInTheDocument();
  });
});
