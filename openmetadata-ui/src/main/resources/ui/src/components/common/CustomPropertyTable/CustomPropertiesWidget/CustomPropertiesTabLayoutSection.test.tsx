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
import { CustomPropertiesTabLayoutSection } from './CustomPropertiesTabLayoutSection';

jest.mock('../../../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: jest.fn(),
}));

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const createProperty = (name: string, typeName: string): CustomProperty => ({
  name,
  description: '',
  propertyType: { id: `${typeName}-id`, name: typeName, type: 'type' },
});

const mockType = (customProperties: CustomProperty[]) =>
  (getTypeByFQN as jest.Mock).mockResolvedValue({
    name: 'table',
    customProperties,
  });

const renderSection = (
  propertyLayout: { name: string; width: 'half' | 'full' }[] = [],
  entityType = 'table'
) => {
  const onChange = jest.fn();

  renderWithQueryClient(
    <DndProvider backend={HTML5Backend}>
      <CustomPropertiesTabLayoutSection
        entityType={entityType}
        propertyLayout={propertyLayout}
        onChange={onChange}
      />
    </DndProvider>
  );

  return { onChange };
};

const getSelectedSize = (name: string) =>
  within(screen.getByTestId(`layout-item-${name}-size`))
    .getAllByRole('tab')
    .find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent;

describe('CustomPropertiesTabLayoutSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loader while the entity type loads', () => {
    (getTypeByFQN as jest.Mock).mockReturnValue(new Promise(jest.fn()));
    renderSection();

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-properties-tab-layout')
    ).not.toBeInTheDocument();
  });

  it('says so when the entity type has no custom properties', async () => {
    mockType([]);
    renderSection();

    expect(
      await screen.findByText('message.no-custom-properties-defined')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-property-layout-editor')
    ).not.toBeInTheDocument();
  });

  it('shows nothing to arrange without an entity type', () => {
    const onChange = jest.fn();
    renderWithQueryClient(
      <CustomPropertiesTabLayoutSection
        propertyLayout={[]}
        onChange={onChange}
      />
    );

    expect(getTypeByFQN).not.toHaveBeenCalled();
    expect(
      screen.getByText('message.no-custom-properties-defined')
    ).toBeInTheDocument();
  });

  it('lays out cards in the saved order and sizes the rest by type', async () => {
    mockType([
      createProperty('owner_team', 'string'),
      createProperty('window', 'timeInterval'),
      createProperty('cost_center', 'string'),
    ]);
    renderSection([{ name: 'cost_center', width: 'full' }]);

    expect(
      await screen.findByText('message.custom-property-layout-hint')
    ).toBeInTheDocument();

    const names = within(screen.getByTestId('custom-property-layout-editor'))
      .getAllByRole('listitem')
      .map((item) => item.getAttribute('data-testid'));

    expect(names).toEqual([
      'layout-item-cost_center',
      'layout-item-owner_team',
      'layout-item-window',
    ]);
    expect(getSelectedSize('cost_center')).toBe('label.large');
    expect(getSelectedSize('owner_team')).toBe('label.small');
    expect(getSelectedSize('window')).toBe('label.large');
  });

  it('reports the whole layout when a card is resized', async () => {
    mockType([
      createProperty('owner_team', 'string'),
      createProperty('window', 'timeInterval'),
    ]);
    const { onChange } = renderSection();

    await user.click(
      within(
        await screen.findByTestId('layout-item-owner_team-size')
      ).getByText('label.large')
    );

    expect(onChange).toHaveBeenCalledWith([
      { name: 'owner_team', width: 'full' },
      { name: 'window', width: 'full' },
    ]);
  });
});
