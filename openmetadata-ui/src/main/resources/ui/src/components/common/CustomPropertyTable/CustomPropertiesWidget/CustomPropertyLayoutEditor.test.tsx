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
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CustomProperty } from '../../../../generated/type/customProperty';
import { LaidOutCustomProperty } from './CustomPropertiesWidget.types';
import { CustomPropertyLayoutEditor } from './CustomPropertyLayoutEditor';

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const createProperty = (name: string): CustomProperty => ({
  name,
  description: '',
  propertyType: { id: 'string-id', name: 'string', type: 'type' },
});

const items: LaidOutCustomProperty[] = [
  { property: createProperty('owner_team'), width: 'full' },
  { property: createProperty('cost_center'), width: 'half' },
];

const renderEditor = () => {
  const onChange = jest.fn();

  render(
    <DndProvider backend={HTML5Backend}>
      <CustomPropertyLayoutEditor items={items} onChange={onChange} />
    </DndProvider>
  );

  return { onChange };
};

describe('CustomPropertyLayoutEditor', () => {
  it('renders each property as a card with a size switch and drag handle', () => {
    renderEditor();

    expect(
      within(screen.getByTestId('layout-item-owner_team')).getByTestId(
        'custom-property-owner_team-card'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('layout-item-owner_team-size')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('layout-item-owner_team-handle')
    ).toBeInTheDocument();
  });

  it('makes a large card small', async () => {
    const { onChange } = renderEditor();

    await user.click(
      within(screen.getByTestId('layout-item-owner_team-size')).getByText(
        'label.small'
      )
    );

    expect(onChange).toHaveBeenCalledWith([
      { ...items[0], width: 'half' },
      items[1],
    ]);
  });

  it('makes a small card large', async () => {
    const { onChange } = renderEditor();

    await user.click(
      within(screen.getByTestId('layout-item-cost_center-size')).getByText(
        'label.large'
      )
    );

    expect(onChange).toHaveBeenCalledWith([
      items[0],
      { ...items[1], width: 'full' },
    ]);
  });

  it('keeps a small card half width between two large ones', () => {
    render(
      <DndProvider backend={HTML5Backend}>
        <CustomPropertyLayoutEditor
          items={[
            { property: createProperty('a'), width: 'full' },
            { property: createProperty('b'), width: 'half' },
            { property: createProperty('c'), width: 'full' },
          ]}
          onChange={jest.fn()}
        />
      </DndProvider>
    );

    expect(screen.getByTestId('layout-item-b')).not.toHaveClass(
      'tw:col-span-2'
    );
    expect(screen.getByTestId('custom-property-layout-editor')).not.toHaveClass(
      'tw:grid-flow-row-dense'
    );
  });
});
