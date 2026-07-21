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

import { fireEvent, render, screen, within } from '@testing-library/react';
import { Glossary } from '../../generated/entity/data/glossary';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import FilterToolbar from './FilterToolbar';
import { FilterToolbarProps, GraphFilters } from './OntologyExplorer.interface';

type MockSearchDropdownProps = {
  searchKey: string;
  options: SearchDropdownOption[];
  selectedKeys: SearchDropdownOption[];
  onSearch: (value: string, searchKey: string) => void;
  onChange: (values: SearchDropdownOption[], searchKey: string) => void;
  onGetInitialOptions?: (searchKey: string) => void;
};

jest.mock('../SearchDropdown/SearchDropdown', () => ({
  __esModule: true,
  default: ({
    searchKey,
    options,
    selectedKeys,
    onSearch,
    onChange,
    onGetInitialOptions,
  }: MockSearchDropdownProps) => (
    <div data-testid={`search-dropdown-${searchKey}`}>
      <input
        data-testid={`search-input-${searchKey}`}
        onChange={(event) => onSearch(event.target.value, searchKey)}
      />
      <button
        data-testid={`init-options-${searchKey}`}
        type="button"
        onClick={() => onGetInitialOptions?.(searchKey)}
      />
      <button
        data-testid={`apply-change-${searchKey}`}
        type="button"
        onClick={() => onChange(options, searchKey)}
      />
      <ul data-testid={`option-list-${searchKey}`}>
        {options.map((option) => (
          <li
            data-testid={`option-${searchKey}-${option.key}`}
            key={option.key}>
            {option.label}
          </li>
        ))}
      </ul>
      <ul data-testid={`selected-list-${searchKey}`}>
        {selectedKeys.map((option) => (
          <li
            data-testid={`selected-${searchKey}-${option.key}`}
            key={option.key}>
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  ),
}));

const buildRelationType = (
  name: string,
  displayName: string
): RelationshipType =>
  ({
    category: 'semantic',
    characteristics: [],
    crossGlossaryAllowed: true,
    description: `${displayName} relationship`,
    displayName,
    fullyQualifiedName: name,
    id: `id-${name}`,
    name,
    paletteKey: 'blue',
    rdfPredicate: `skos:${name}`,
    systemDefined: true,
  } as unknown as RelationshipType);

const glossaries: Glossary[] = [
  { displayName: 'Sales', id: 'g1', name: 'sales' },
  { displayName: 'Finance', id: 'g2', name: 'finance' },
];

const relationTypes: RelationshipType[] = [
  buildRelationType('broader', 'Broader'),
  buildRelationType('related', 'Related'),
];

const baseFilters: GraphFilters = {
  glossaryIds: [],
  relationTypes: [],
  searchQuery: '',
  showCrossGlossaryOnly: false,
  showIsolatedNodes: false,
  viewMode: 'overview',
};

const renderToolbar = (overrides: Partial<FilterToolbarProps> = {}) => {
  const props: FilterToolbarProps = {
    filters: baseFilters,
    glossaries,
    onFiltersChange: jest.fn(),
    onViewModeChange: jest.fn(),
    relationTypes,
    ...overrides,
  };

  return { ...render(<FilterToolbar {...props} />), props };
};

const openViewModeSelect = () => {
  const trigger = within(screen.getByTestId('view-mode-select')).getByRole(
    'button'
  );
  fireEvent.click(trigger);
};

describe('FilterToolbar view mode selection', () => {
  it.each([
    ['label.hierarchy', 'hierarchy', 'overview'],
    ['label.cross-glossary', 'crossGlossary', 'overview'],
    ['label.overview', 'overview', 'hierarchy'],
  ])(
    'maps the %s option to the %s GraphViewMode',
    async (optionLabel, expectedMode, startMode) => {
      const { props } = renderToolbar({
        filters: {
          ...baseFilters,
          viewMode: startMode as GraphFilters['viewMode'],
        },
      });

      openViewModeSelect();
      fireEvent.click(await screen.findByRole('option', { name: optionLabel }));

      expect(props.onViewModeChange).toHaveBeenCalledWith(expectedMode);
    }
  );

  it('exposes only the known view modes so unknown keys are never emitted', async () => {
    renderToolbar();

    openViewModeSelect();
    const options = await screen.findAllByRole('option');

    expect(options).toHaveLength(3);
    expect(
      screen.getByRole('option', { name: 'label.overview' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'label.hierarchy' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'label.cross-glossary' })
    ).toBeInTheDocument();
  });

  it.each([
    ['viewModeDisabled', { viewModeDisabled: true }],
    ['isLoading', { isLoading: true }],
  ])('disables the view-mode select when %s is set', (_label, overrides) => {
    renderToolbar(overrides);

    expect(
      within(screen.getByTestId('view-mode-select')).getByRole('button')
    ).toBeDisabled();
  });
});

describe('FilterToolbar glossary and relation-type filters', () => {
  it('filters glossary options case-insensitively and restores the full list on an empty query', () => {
    renderToolbar();

    fireEvent.change(screen.getByTestId('search-input-glossaryIds'), {
      target: { value: 'sal' },
    });

    expect(screen.getByTestId('option-glossaryIds-g1')).toBeInTheDocument();
    expect(
      screen.queryByTestId('option-glossaryIds-g2')
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('search-input-glossaryIds'), {
      target: { value: '' },
    });

    expect(screen.getByTestId('option-glossaryIds-g1')).toBeInTheDocument();
    expect(screen.getByTestId('option-glossaryIds-g2')).toBeInTheDocument();
  });

  it('merges selected glossary ids into filters without dropping other fields', () => {
    const { props } = renderToolbar({
      filters: { ...baseFilters, relationTypes: ['broader'] },
    });

    fireEvent.click(screen.getByTestId('init-options-glossaryIds'));
    fireEvent.click(screen.getByTestId('apply-change-glossaryIds'));

    expect(props.onFiltersChange).toHaveBeenCalledWith({
      ...baseFilters,
      glossaryIds: ['g1', 'g2'],
      relationTypes: ['broader'],
    });
  });

  it('merges selected relation types into filters without dropping other fields', () => {
    const { props } = renderToolbar({
      filters: { ...baseFilters, glossaryIds: ['g1'] },
    });

    fireEvent.click(screen.getByTestId('init-options-relationTypes'));
    fireEvent.click(screen.getByTestId('apply-change-relationTypes'));

    expect(props.onFiltersChange).toHaveBeenCalledWith({
      ...baseFilters,
      glossaryIds: ['g1'],
      relationTypes: ['broader', 'related'],
    });
  });

  it('reflects only the intersection of filters and available options as selected keys', () => {
    renderToolbar({
      filters: {
        ...baseFilters,
        glossaryIds: ['g1', 'missing-glossary'],
        relationTypes: ['related', 'ghost-relation'],
      },
    });

    expect(screen.getByTestId('selected-glossaryIds-g1')).toBeInTheDocument();
    expect(
      screen.queryByTestId('selected-glossaryIds-g2')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('selected-glossaryIds-missing-glossary')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('selected-relationTypes-related')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('selected-relationTypes-broader')
    ).not.toBeInTheDocument();
  });
});

describe('FilterToolbar isolated toggle', () => {
  it.each([
    [
      'showCrossGlossaryOnly',
      { filters: { ...baseFilters, showCrossGlossaryOnly: true } },
    ],
    ['isLoading', { isLoading: true }],
  ])('disables the isolated toggle when %s is set', (_label, overrides) => {
    renderToolbar(overrides);

    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('sets showIsolatedNodes when the isolated toggle is switched on', () => {
    const { props } = renderToolbar({
      filters: { ...baseFilters, showIsolatedNodes: false },
    });

    fireEvent.click(screen.getByRole('switch'));

    expect(props.onFiltersChange).toHaveBeenCalledWith({
      ...baseFilters,
      showIsolatedNodes: true,
    });
  });
});

describe('FilterToolbar load-more control', () => {
  it('does not render the load-more button when onLoadMore is undefined', () => {
    renderToolbar();

    expect(
      screen.queryByTestId('ontology-load-more-btn')
    ).not.toBeInTheDocument();
  });

  it.each([
    [
      'no more terms',
      { hasMoreTerms: false, isLoading: false, isLoadingMore: false },
    ],
    ['loading', { hasMoreTerms: true, isLoading: true, isLoadingMore: false }],
    [
      'loading more',
      { hasMoreTerms: true, isLoading: false, isLoadingMore: true },
    ],
  ])('disables the load-more button while %s', (_label, overrides) => {
    renderToolbar({ onLoadMore: jest.fn(), ...overrides });

    expect(screen.getByTestId('ontology-load-more-btn')).toBeDisabled();
  });

  it('fires onLoadMore when the enabled load-more button is clicked', () => {
    const onLoadMore = jest.fn();
    renderToolbar({
      hasMoreTerms: true,
      isLoading: false,
      isLoadingMore: false,
      onLoadMore,
    });

    fireEvent.click(screen.getByTestId('ontology-load-more-btn'));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});

describe('FilterToolbar clear-all control', () => {
  it('does not render clear-all when there are no active filters', () => {
    renderToolbar({ onClearAll: jest.fn() });

    expect(
      screen.queryByTestId('ontology-clear-all-btn')
    ).not.toBeInTheDocument();
  });

  it('does not render clear-all when onClearAll is undefined', () => {
    renderToolbar({ filters: { ...baseFilters, glossaryIds: ['g1'] } });

    expect(
      screen.queryByTestId('ontology-clear-all-btn')
    ).not.toBeInTheDocument();
  });

  it('renders clear-all when active filters exist and fires onClearAll on click', () => {
    const onClearAll = jest.fn();
    renderToolbar({
      filters: { ...baseFilters, glossaryIds: ['g1'] },
      onClearAll,
    });

    fireEvent.click(screen.getByTestId('ontology-clear-all-btn'));

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
