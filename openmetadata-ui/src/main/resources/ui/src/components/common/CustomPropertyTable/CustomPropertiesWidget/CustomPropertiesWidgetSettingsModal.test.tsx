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
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CustomProperty } from '../../../../generated/type/customProperty';
import { getTypeByFQN } from '../../../../rest/metadataTypeAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { CustomPropertiesWidgetSettingsModal } from './CustomPropertiesWidgetSettingsModal';

jest.mock('../../../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: jest.fn(),
}));

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const createProperty = (name: string): CustomProperty => ({
  name,
  displayName: name,
  description: '',
  propertyType: { id: 'string-id', name: 'string', type: 'type' },
});

type WidgetSettings = {
  displayMode: 'default' | 'all' | 'selected';
  propertyNames: string[];
  showHeader: boolean;
  size: 'small' | 'large';
  propertyLayout: { name: string; width: 'half' | 'full' }[];
};

const baseSettings: WidgetSettings = {
  displayMode: 'all',
  propertyNames: [],
  showHeader: true,
  size: 'small',
  propertyLayout: [{ name: 'a', width: 'half' }],
};

const renderModal = (settings: Partial<WidgetSettings> = {}) => {
  const onSave = jest.fn();
  const onCancel = jest.fn();

  renderWithQueryClient(
    <DndProvider backend={HTML5Backend}>
      <CustomPropertiesWidgetSettingsModal
        entityType="table"
        settings={{ ...baseSettings, ...settings }}
        onCancel={onCancel}
        onSave={onSave}
      />
    </DndProvider>
  );

  return { onSave, onCancel };
};

describe('CustomPropertiesWidgetSettingsModal', () => {
  beforeEach(() => {
    (getTypeByFQN as jest.Mock).mockResolvedValue({
      name: 'table',
      customProperties: ['a', 'b'].map(createProperty),
    });
  });

  it('opens with the widget settings form and its current style', async () => {
    renderModal();

    const modal = screen.getByTestId('custom-properties-widget-settings-modal');

    expect(within(modal).getByText('label.configure-entity')).toBeVisible();
    expect(
      await within(modal).findByTestId('custom-property-checkbox-list')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('widget-style-preview')).getByRole('radio')
    ).toBeChecked();
  });

  it('saves the settings unchanged with the preview style', async () => {
    const { onSave } = renderModal();

    await user.click(screen.getByTestId('save-widget-settings'));

    expect(onSave).toHaveBeenCalledWith(baseSettings, 'preview');
  });

  it('saves a large widget when full width is picked', async () => {
    const { onSave } = renderModal();

    await user.click(screen.getByTestId('widget-style-fullWidth'));
    await user.click(screen.getByTestId('save-widget-settings'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ size: 'large' }),
      'fullWidth'
    );
  });

  it('opens a large widget on the full width style', () => {
    renderModal({ size: 'large' });

    expect(
      within(screen.getByTestId('widget-style-fullWidth')).getByRole('radio')
    ).toBeChecked();
  });

  it('blocks saving an empty selection until a property is ticked', async () => {
    const { onSave } = renderModal({ displayMode: 'selected' });

    expect(screen.getByTestId('save-widget-settings')).toBeDisabled();

    await user.click(
      within(await screen.findByTestId('picker-item-b')).getByRole('checkbox')
    );
    await user.click(screen.getByTestId('save-widget-settings'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        displayMode: 'selected',
        propertyNames: ['b'],
      }),
      'preview'
    );
  });

  it('cancels from the footer without saving', async () => {
    const { onSave, onCancel } = renderModal();

    await user.click(screen.getByText('label.cancel'));

    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('cancels when dismissed with Escape', async () => {
    const { onCancel } = renderModal();

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalled();
  });
});
