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
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomProperty } from '../../../../generated/entity/type';
import CustomPropertiesSection from './CustomPropertiesSection';
import { CustomPropertiesSectionProps } from './CustomPropertiesSection.interface';

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

jest.mock('../../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div data-testid="loader" />)
);

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ children, type }) => (
    <div data-testid="error-placeholder" data-type={type}>
      {children}
    </div>
  )),
}));

const createProperty = (
  name: string,
  displayName: string,
  typeName = 'string'
): CustomProperty => ({
  name,
  displayName,
  description: `${name} description`,
  propertyType: { id: `${typeName}-id`, name: typeName, type: 'type' },
});

const customProperties = [
  createProperty('owner_team', 'Owner Team'),
  createProperty('cost_center', 'Cost Center'),
  createProperty('row_count', 'Row Count', 'integer'),
];

const renderSection = (props: Partial<CustomPropertiesSectionProps> = {}) => {
  const onExtensionUpdate = jest.fn().mockResolvedValue(undefined);

  render(
    <CustomPropertiesSection
      hasEditPermissions
      viewCustomPropertiesPermission
      entityData={{ extension: { owner_team: 'Data Platform', row_count: 5 } }}
      entityTypeDetail={{ customProperties }}
      isEntityDataLoading={false}
      onExtensionUpdate={onExtensionUpdate}
      {...props}
    />
  );

  return { onExtensionUpdate };
};

const getRenderedNames = () =>
  screen.getAllByTestId('property-name').map((node) => node.textContent);

const search = async (text: string) => {
  const input = screen.getByTestId('searchbar');
  await user.clear(input);
  if (text) {
    await user.type(input, text);
  }
};

describe('CustomPropertiesSection', () => {
  it('renders the loader while the entity is loading', () => {
    renderSection({ isEntityDataLoading: true });

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-properties-list')
    ).not.toBeInTheDocument();
  });

  it('renders the permission placeholder without view permission', () => {
    renderSection({ viewCustomPropertiesPermission: false });

    expect(screen.getByTestId('error-placeholder')).toHaveAttribute(
      'data-type',
      'PERMISSION'
    );
    expect(screen.queryByTestId('searchbar')).not.toBeInTheDocument();
  });

  it('renders the empty placeholder when the entity type has no properties', () => {
    renderSection({ entityTypeDetail: { customProperties: [] } });

    expect(screen.getByTestId('error-placeholder')).toHaveAttribute(
      'data-type',
      'CUSTOM'
    );
    expect(screen.getByTestId('error-placeholder')).toHaveTextContent(
      'message.no-custom-properties-entity'
    );
    expect(screen.queryByTestId('searchbar')).not.toBeInTheDocument();
  });

  it('renders one row per property with its value summary', () => {
    renderSection();

    expect(getRenderedNames()).toEqual([
      'Owner Team',
      'Cost Center',
      'Row Count',
    ]);

    const ownerRow = screen.getByTestId('custom-property-owner_team-row');

    expect(within(ownerRow).getByTestId('property-value')).toHaveTextContent(
      'Data Platform'
    );
    expect(
      within(screen.getByTestId('custom-property-cost_center-row')).getByTestId(
        'property-value'
      )
    ).toHaveTextContent('label.not-set');
  });

  it('filters rows by name, display name and type, ignoring case', async () => {
    renderSection();

    await search('COST_');

    expect(getRenderedNames()).toEqual(['Cost Center']);

    await search('owner team');

    expect(getRenderedNames()).toEqual(['Owner Team']);

    await search('integer');

    expect(getRenderedNames()).toEqual(['Row Count']);

    await search('');

    expect(getRenderedNames()).toHaveLength(3);
  });

  it('shows a no-match message when the search matches nothing', async () => {
    renderSection();

    await search('nonexistent');

    expect(
      screen.getByTestId('no-matching-custom-properties')
    ).toHaveTextContent('message.no-entity-found-for-name');
    expect(
      screen.queryByTestId('custom-properties-list')
    ).not.toBeInTheDocument();
  });

  it('hides the edit action without edit permission', () => {
    renderSection({ hasEditPermissions: false });

    expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
  });

  it('merges the edited value into the extension on save', async () => {
    const { onExtensionUpdate } = renderSection();

    const costRow = screen.getByTestId('custom-property-cost_center-row');
    await user.click(within(costRow).getByTestId('edit-icon'));
    await user.type(screen.getByTestId('value-input'), 'CC-42');
    await user.click(screen.getByTestId('inline-save-btn'));

    expect(onExtensionUpdate).toHaveBeenCalledWith({
      owner_team: 'Data Platform',
      row_count: 5,
      cost_center: 'CC-42',
    });

    await waitFor(() =>
      expect(
        screen.queryByTestId('custom-property-edit-modal')
      ).not.toBeInTheDocument()
    );
  });
});
