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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  CUSTOM_PROPERTIES_WIDGET,
  TAB_GRID_MAX_COLUMNS,
} from '../../../../constants/CustomizeWidgets.constants';
import { CustomProperty } from '../../../../generated/type/customProperty';
import { AddCustomPropertiesWidgetTabContent } from './AddCustomPropertiesWidgetTabContent';

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const createProperty = (name: string): CustomProperty => ({
  name,
  displayName: name,
  description: '',
  propertyType: { id: 'string-id', name: 'string', type: 'type' },
});

jest.mock('../../../../hooks/useEntityTypeCustomProperties', () => ({
  useEntityTypeCustomProperties: () => ({
    customProperties: ['a', 'b', 'c'].map(createProperty),
    isLoading: false,
  }),
}));

const renderContent = () => {
  const onAdd = jest.fn();
  const onCancel = jest.fn();

  render(
    <DndProvider backend={HTML5Backend}>
      <AddCustomPropertiesWidgetTabContent
        entityType="table"
        maxGridSizeSupport={TAB_GRID_MAX_COLUMNS}
        widget={CUSTOM_PROPERTIES_WIDGET}
        onAdd={onAdd}
        onCancel={onCancel}
      />
    </DndProvider>
  );

  return { onAdd, onCancel };
};

describe('AddCustomPropertiesWidgetTabContent', () => {
  it('waits for a widget style before the properties or Add', () => {
    renderContent();

    expect(screen.getByTestId('add-widget-button')).toBeDisabled();
    expect(screen.getByTestId('custom-property-picker-search')).toBeDisabled();
    expect(
      screen.getByText('message.choose-widget-style-first')
    ).toBeInTheDocument();
  });

  it('adds a full-width widget across the tab with large cards', async () => {
    const { onAdd } = renderContent();

    await user.click(screen.getByTestId('widget-style-fullWidth'));
    await user.click(screen.getByTestId('add-widget-button'));

    expect(onAdd).toHaveBeenCalledWith(
      CUSTOM_PROPERTIES_WIDGET,
      TAB_GRID_MAX_COLUMNS,
      expect.objectContaining({ displayMode: 'default', size: 'large' })
    );
  });

  it('adds a preview widget as a side column of rows', async () => {
    const { onAdd } = renderContent();

    await user.click(screen.getByTestId('widget-style-preview'));
    await user.click(screen.getByTestId('picker-clear'));

    expect(screen.getByTestId('add-widget-button')).toBeDisabled();

    await user.click(screen.getByTestId('custom-property-checkbox-b'));
    await user.click(screen.getByTestId('add-widget-button'));

    expect(onAdd).toHaveBeenCalledWith(
      CUSTOM_PROPERTIES_WIDGET,
      2,
      expect.objectContaining({
        displayMode: 'selected',
        propertyNames: ['b'],
        size: 'small',
      })
    );
  });

  it('closes the dialog on Cancel', async () => {
    const { onCancel } = renderContent();

    await user.click(screen.getByText('label.cancel'));

    expect(onCancel).toHaveBeenCalled();
  });
});
