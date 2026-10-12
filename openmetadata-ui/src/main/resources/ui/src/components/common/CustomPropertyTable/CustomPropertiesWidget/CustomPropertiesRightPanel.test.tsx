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
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CustomProperty } from '../../../../generated/type/customProperty';
import { CustomPropertiesRightPanel } from './CustomPropertiesRightPanel';
import { CustomPropertiesWidgetSettings } from './CustomPropertiesWidget.interface';

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const createProperty = (name: string, displayName: string): CustomProperty => ({
  name,
  displayName,
  description: `${name} description`,
  propertyType: { id: 'string-id', name: 'string', type: 'type' },
});

const properties = [
  createProperty('owner_team', 'Owner Team'),
  createProperty('cost_center', 'Cost Center'),
];

const renderPanel = (hasEditPermissions = true, viewAllPath?: string) =>
  render(
    <CustomPropertiesRightPanel
      extension={{ owner_team: 'Data Platform' }}
      hasEditPermissions={hasEditPermissions}
      properties={properties}
      viewAllPath={viewAllPath}
      onValueSave={jest.fn()}
    />,
    { wrapper: MemoryRouter }
  );

const renderWidget = (
  widgetSettings: Partial<CustomPropertiesWidgetSettings>
) =>
  render(
    <CustomPropertiesRightPanel
      hasEditPermissions
      extension={{ owner_team: 'Data Platform' }}
      properties={properties}
      widgetSettings={{
        displayMode: 'all',
        propertyNames: [],
        showHeader: true,
        size: 'small',
        propertyLayout: [],
        ...widgetSettings,
      }}
      onValueSave={jest.fn()}
    />,
    { wrapper: MemoryRouter }
  );

const getRenderedNames = () =>
  screen.getAllByTestId('property-name').map((node) => node.textContent);

describe('CustomPropertiesRightPanel', () => {
  it('renders the shared widget card header with the collapse button', () => {
    renderPanel();

    const widget = screen.getByTestId('custom-properties-widget');

    expect(
      within(widget).getByText('label.custom-property-plural')
    ).toBeInTheDocument();
    expect(
      within(widget).getByTestId('expand-collapse-icon')
    ).toBeInTheDocument();
  });

  it('filters properties from the header search', async () => {
    renderPanel();

    expect(getRenderedNames()).toEqual(['Owner Team', 'Cost Center']);

    await user.click(
      screen.getByTestId('custom-properties-widget-search-button')
    );
    await user.type(
      screen.getByTestId('custom-properties-widget-search'),
      'cost'
    );

    expect(getRenderedNames()).toEqual(['Cost Center']);
  });

  it('shows an empty message when the search matches nothing', async () => {
    renderPanel();

    await user.click(
      screen.getByTestId('custom-properties-widget-search-button')
    );
    await user.type(
      screen.getByTestId('custom-properties-widget-search'),
      'missing'
    );

    expect(
      screen.getByTestId('no-matching-custom-properties')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-properties-widget-list')
    ).not.toBeInTheDocument();
  });

  it('clears and closes the search on Escape', async () => {
    renderPanel();

    await user.click(
      screen.getByTestId('custom-properties-widget-search-button')
    );
    await user.type(
      screen.getByTestId('custom-properties-widget-search'),
      'cost{Escape}'
    );

    expect(
      screen.getByTestId('custom-properties-widget-search-button')
    ).toBeInTheDocument();
    expect(getRenderedNames()).toEqual(['Owner Team', 'Cost Center']);
  });

  it('replaces the header title with the open search field', async () => {
    renderPanel();

    await user.click(
      screen.getByTestId('custom-properties-widget-search-button')
    );

    expect(
      screen.queryByText('label.custom-property-plural')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('expand-collapse-icon')
    ).not.toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getByTestId('custom-properties-widget-search')
      ).toHaveFocus()
    );
  });

  it('clears and closes the search from the close button', async () => {
    renderPanel();

    await user.click(
      screen.getByTestId('custom-properties-widget-search-button')
    );
    await user.type(
      screen.getByTestId('custom-properties-widget-search'),
      'cost'
    );
    await user.click(
      screen.getByTestId('custom-properties-widget-search-close')
    );

    expect(
      screen.getByText('label.custom-property-plural')
    ).toBeInTheDocument();
    expect(getRenderedNames()).toEqual(['Owner Team', 'Cost Center']);
    expect(
      screen.getByTestId('custom-properties-widget-search-button')
    ).toHaveFocus();
  });

  it('offers only the edit icon, including for properties without a value', () => {
    renderPanel();

    const emptyRow = screen.getByTestId('custom-property-cost_center-row');

    expect(within(emptyRow).getByTestId('edit-icon')).toBeInTheDocument();
    expect(within(emptyRow).queryByText('label.add')).not.toBeInTheDocument();
  });

  it('links to the Custom Properties tab when the widget hides properties', () => {
    renderPanel(true, '/table/fqn/custom_properties');

    expect(
      screen.getByTestId('custom-properties-widget-view-all')
    ).toHaveAttribute('href', '/table/fqn/custom_properties');
  });

  it('omits the view-all link when every property is listed', () => {
    renderPanel();

    expect(
      screen.queryByTestId('custom-properties-widget-view-all')
    ).not.toBeInTheDocument();
  });

  it('renders every property as a small row by default', () => {
    renderWidget({});

    expect(
      screen.getByTestId('custom-property-owner_team-row')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('custom-property-cost_center-row')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-property-owner_team-card')
    ).not.toBeInTheDocument();
  });

  it('renders large layout items as cards and the rest as rows', () => {
    renderWidget({
      propertyLayout: [{ name: 'cost_center', width: 'full', size: 'large' }],
    });

    const largeCard = screen.getByTestId('custom-property-cost_center-card');

    expect(
      within(largeCard).getByTestId('add-value-button')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('custom-property-owner_team-row')
    ).toBeInTheDocument();
  });

  it('renders large cards by default in a large widget', () => {
    renderWidget({
      size: 'large',
      propertyLayout: [{ name: 'owner_team', width: 'full', size: 'small' }],
    });

    expect(
      screen.getByTestId('custom-property-cost_center-card')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('custom-property-owner_team-row')
    ).toBeInTheDocument();
  });

  it('keeps the chosen sizes when the widget header is hidden', () => {
    renderWidget({
      showHeader: false,
      propertyLayout: [{ name: 'owner_team', width: 'half', size: 'large' }],
    });

    expect(
      screen.getByTestId('custom-properties-widget-cards')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('custom-property-owner_team-card')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('custom-property-cost_center-row')
    ).toBeInTheDocument();
  });

  it('hides the edit icon without edit permission', () => {
    renderPanel(false);

    expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
  });
});
