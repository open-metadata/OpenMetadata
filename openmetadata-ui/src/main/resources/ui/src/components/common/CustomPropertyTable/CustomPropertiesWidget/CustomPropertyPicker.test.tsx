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
import { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CustomProperty } from '../../../../generated/type/customProperty';
import { DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS } from './CustomPropertiesWidget.constants';
import { CustomPropertiesWidgetSettings } from './CustomPropertiesWidget.interface';
import { CustomPropertyPicker } from './CustomPropertyPicker';

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const createProperty = (name: string): CustomProperty => ({
  name,
  displayName: name,
  description: '',
  propertyType: { id: 'string-id', name: 'string', type: 'type' },
});

const properties = ['a', 'b', 'c', 'd', 'e', 'f'].map(createProperty);

const renderPicker = (
  initial: Partial<CustomPropertiesWidgetSettings> = {},
  isDisabled = false
) => {
  const onChange = jest.fn();

  const Harness = () => {
    const [value, setValue] = useState<CustomPropertiesWidgetSettings>({
      ...DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS,
      ...initial,
    });

    return (
      <CustomPropertyPicker
        isDisabled={isDisabled}
        properties={properties}
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  };

  render(
    <DndProvider backend={HTML5Backend}>
      <Harness />
    </DndProvider>
  );

  return { lastValue: () => onChange.mock.calls.at(-1)?.[0] };
};

const rowNames = () =>
  within(screen.getByTestId('custom-property-checkbox-list'))
    .getAllByRole('listitem')
    .map((row) => row.getAttribute('data-testid'));

const checkedNames = () =>
  properties
    .map(({ name }) => name)
    .filter(
      (name) =>
        (
          screen
            .getByTestId(`custom-property-checkbox-${name}`)
            .querySelector('input') as HTMLInputElement
        ).checked
    );

describe('CustomPropertyPicker', () => {
  it('opens a new widget on Selected with the first five ticked', () => {
    renderPicker();

    expect(screen.getByTestId('picker-tab-selected')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(rowNames()).toHaveLength(properties.length);
    expect(checkedNames()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('ticks every property when switching to All', async () => {
    const { lastValue } = renderPicker();

    await user.click(screen.getByTestId('picker-tab-all'));

    expect(lastValue()).toMatchObject({ displayMode: 'all' });
    expect(checkedNames()).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(screen.queryByTestId('picker-select-all')).not.toBeInTheDocument();
  });

  it('restores the selection when switching back to Selected', async () => {
    renderPicker({ displayMode: 'selected', propertyNames: ['b', 'e'] });

    await user.click(screen.getByTestId('picker-tab-all'));
    await user.click(screen.getByTestId('picker-tab-selected'));

    expect(checkedNames()).toEqual(['b', 'e']);
  });

  it('turns All into a selection of the rest when a property is unticked', async () => {
    const { lastValue } = renderPicker({ displayMode: 'all' });

    await user.click(
      within(screen.getByTestId('picker-item-c')).getByRole('checkbox')
    );

    expect(lastValue()).toMatchObject({
      displayMode: 'selected',
      propertyNames: ['a', 'b', 'd', 'e', 'f'],
    });
    expect(screen.getByTestId('picker-tab-selected')).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('keeps ticked properties in list order', async () => {
    const { lastValue } = renderPicker({
      displayMode: 'selected',
      propertyNames: ['c'],
    });

    await user.click(
      within(screen.getByTestId('picker-item-a')).getByRole('checkbox')
    );

    expect(lastValue()).toMatchObject({
      displayMode: 'selected',
      propertyNames: ['a', 'c'],
    });
  });

  it('selects all and clears on the Selected tab', async () => {
    const { lastValue } = renderPicker({
      displayMode: 'selected',
      propertyNames: ['a'],
    });

    await user.click(screen.getByTestId('picker-select-all'));

    expect(lastValue()).toMatchObject({
      displayMode: 'selected',
      propertyNames: ['a', 'b', 'c', 'd', 'e', 'f'],
    });

    await user.click(screen.getByTestId('picker-clear'));

    expect(lastValue()).toMatchObject({
      displayMode: 'selected',
      propertyNames: [],
    });
  });

  it('filters rows by search text', async () => {
    renderPicker();

    await user.type(screen.getByTestId('custom-property-picker-search'), 'd');

    expect(rowNames()).toEqual(['picker-item-d']);
  });

  it('disables every control until a widget style is picked', () => {
    renderPicker({}, true);

    expect(
      within(screen.getByTestId('picker-item-a')).getByRole('checkbox')
    ).toBeDisabled();
    expect(screen.getByTestId('picker-select-all')).toBeDisabled();
  });
});
