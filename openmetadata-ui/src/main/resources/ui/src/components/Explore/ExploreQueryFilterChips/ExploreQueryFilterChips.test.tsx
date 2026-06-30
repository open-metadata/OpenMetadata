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
import { fireEvent, render, screen } from '@testing-library/react';
import { ExploreQuickFilterField } from '../ExplorePage.interface';
import ExploreQueryFilterChips from './ExploreQueryFilterChips.component';

const dataAssetField: ExploreQuickFilterField = {
  key: 'entityType.keyword',
  label: 'label.data-asset-plural',
  value: [
    { key: 'table', label: 'Table' },
    { key: 'tableColumn', label: 'Column' },
  ],
};

const serviceField: ExploreQuickFilterField = {
  key: 'service.displayName.keyword',
  label: 'label.service',
  value: [{ key: 'redshift prod', label: 'redshift prod' }],
};

const emptyField: ExploreQuickFilterField = {
  key: 'tier.tagFQN',
  label: 'label.tier',
  value: [],
};

describe('ExploreQueryFilterChips', () => {
  it('renders nothing when no filter has a selected value', () => {
    const { container } = render(
      <ExploreQueryFilterChips
        fields={[emptyField]}
        onRemoveValue={jest.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when only additional query is active', () => {
    const { container } = render(
      <ExploreQueryFilterChips
        hasAdditionalQuery
        fields={[emptyField]}
        onRemoveValue={jest.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders one removable chip per selected value across fields', () => {
    render(
      <ExploreQueryFilterChips
        fields={[dataAssetField, serviceField, emptyField]}
        onRemoveValue={jest.fn()}
      />
    );

    expect(
      screen.getByTestId('query-chip-entityType.keyword-table')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('query-chip-entityType.keyword-tableColumn')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('query-chip-service.displayName.keyword-redshift prod')
    ).toBeInTheDocument();

    // Entity-type chip values render through getEntityNameLabel
    // (table -> label.table, tableColumn -> label.column).
    expect(screen.getByText('label.table')).toBeInTheDocument();
    expect(screen.getByText('label.column')).toBeInTheDocument();
  });

  it('calls onRemoveValue with the field and option key when a chip is removed', () => {
    const onRemoveValue = jest.fn();

    render(
      <ExploreQueryFilterChips
        fields={[dataAssetField]}
        onRemoveValue={onRemoveValue}
      />
    );

    fireEvent.click(
      screen.getByTestId('remove-chip-entityType.keyword-tableColumn')
    );

    expect(onRemoveValue).toHaveBeenCalledWith(dataAssetField, 'tableColumn');
  });

  it('renders the persistent empty state when emptyText is provided', () => {
    render(
      <ExploreQueryFilterChips
        emptyText="Browsing your whole data estate"
        fields={[emptyField]}
        onRemoveValue={jest.fn()}
      />
    );

    expect(screen.getByTestId('query-bar-empty-text')).toHaveTextContent(
      'Browsing your whole data estate'
    );
    expect(screen.queryByTestId('clear-all-chips')).not.toBeInTheDocument();
  });

  it('renders browse-location chips before filter chips with level labels', () => {
    const browseFields = [
      {
        key: 'entityType',
        label: 'Databases',
        value: [
          { key: 'table', label: 'table' },
          { key: 'tableColumn', label: 'tableColumn' },
        ],
      },
      {
        key: 'service.displayName.keyword',
        label: 'service.displayName.keyword',
        value: [{ key: 'redshift prod', label: 'redshift prod' }],
      },
    ];

    render(
      <ExploreQueryFilterChips
        browseFields={browseFields}
        fields={[dataAssetField]}
        onRemoveValue={jest.fn()}
      />
    );

    const categoryChip = screen.getByTestId('browse-chip-entityType');
    const serviceChip = screen.getByTestId(
      'browse-chip-service.displayName.keyword'
    );

    expect(categoryChip).toHaveTextContent('label.in');
    expect(categoryChip).toHaveTextContent('Databases');
    expect(serviceChip).toHaveTextContent('label.service');
    expect(serviceChip).toHaveTextContent('redshift prod');
    expect(
      screen.getByTestId('query-chip-entityType.keyword-table')
    ).toBeInTheDocument();
  });

  it('removes a browse level through onRemoveBrowseLevel', () => {
    const onRemoveBrowseLevel = jest.fn();

    render(
      <ExploreQueryFilterChips
        browseFields={[
          {
            key: 'serviceType',
            label: 'serviceType',
            value: [{ key: 'Redshift', label: 'Redshift' }],
          },
        ]}
        fields={[]}
        onRemoveBrowseLevel={onRemoveBrowseLevel}
        onRemoveValue={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('remove-browse-chip-serviceType'));

    expect(onRemoveBrowseLevel).toHaveBeenCalledWith('serviceType');
  });

  it('renders and fires the clear-all action only when provided', () => {
    const onClearAll = jest.fn();
    const { rerender } = render(
      <ExploreQueryFilterChips
        fields={[dataAssetField]}
        onRemoveValue={jest.fn()}
      />
    );

    expect(screen.queryByTestId('clear-all-chips')).not.toBeInTheDocument();

    rerender(
      <ExploreQueryFilterChips
        fields={[dataAssetField]}
        onClearAll={onClearAll}
        onRemoveValue={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('clear-all-chips'));

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
