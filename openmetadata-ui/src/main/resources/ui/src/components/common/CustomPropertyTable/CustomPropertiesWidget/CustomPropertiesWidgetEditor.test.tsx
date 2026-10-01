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
import { DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS } from './CustomPropertiesWidget.constants';
import { CustomPropertiesWidgetSettings } from './CustomPropertiesWidget.interface';
import {
  CustomPropertiesWidgetEditor,
  CustomPropertiesWidgetHeaderInfo,
} from './CustomPropertiesWidgetEditor';

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

const settingsWith = (
  overrides: Partial<CustomPropertiesWidgetSettings>
): CustomPropertiesWidgetSettings => ({
  ...DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS,
  displayMode: 'all',
  ...overrides,
});

const renderEditor = (settings: CustomPropertiesWidgetSettings) => {
  const onChange = jest.fn();

  render(
    <DndProvider backend={HTML5Backend}>
      <CustomPropertiesWidgetEditor
        entityType="table"
        settings={settings}
        onChange={onChange}
      />
    </DndProvider>
  );

  return { onChange };
};

describe('CustomPropertiesWidgetEditor', () => {
  it('lists a preview widget as rows with drag handles and no size switch', () => {
    renderEditor(settingsWith({ size: 'small' }));

    expect(screen.getByTestId('custom-property-a-row')).toBeInTheDocument();
    expect(screen.getByTestId('layout-item-a-handle')).toBeInTheDocument();
    expect(screen.queryByTestId('layout-item-a-size')).not.toBeInTheDocument();
  });

  it('switches a full-width card from large to small in place', async () => {
    const { onChange } = renderEditor(
      settingsWith({
        size: 'large',
        propertyLayout: [{ name: 'hidden', width: 'half' }],
      })
    );

    await user.click(
      within(screen.getByTestId('layout-item-b-size')).getByText('label.small')
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyLayout: [
          { name: 'a', width: 'full' },
          { name: 'b', width: 'half' },
          { name: 'c', width: 'full' },
          { name: 'hidden', width: 'half' },
        ],
      })
    );
  });
});

describe('CustomPropertiesWidgetHeaderInfo', () => {
  it('shows the style and the small and large counts for full width', () => {
    render(
      <CustomPropertiesWidgetHeaderInfo
        entityType="table"
        settings={settingsWith({
          size: 'large',
          propertyLayout: [{ name: 'a', width: 'half' }],
        })}
      />
    );

    expect(
      screen.getByTestId('custom-properties-widget-style')
    ).toHaveTextContent('label.full-width');
    expect(
      screen.getByText('message.custom-property-card-size-count')
    ).toBeInTheDocument();
  });

  it('shows only the style for a preview', () => {
    render(
      <CustomPropertiesWidgetHeaderInfo
        entityType="table"
        settings={settingsWith({ size: 'small' })}
      />
    );

    expect(
      screen.getByTestId('custom-properties-widget-style')
    ).toHaveTextContent('label.preview');
    expect(
      screen.queryByText('message.custom-property-card-size-count')
    ).not.toBeInTheDocument();
  });
});
