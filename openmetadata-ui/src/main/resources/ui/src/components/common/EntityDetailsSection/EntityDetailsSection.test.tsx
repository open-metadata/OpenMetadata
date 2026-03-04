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
import { render, screen } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import {
  SearchedDataProps,
  SourceType,
} from '../../SearchedData/SearchedData.interface';
import EntityDetailsSection from './EntityDetailsSection';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

// Mock SearchBarComponent
jest.mock('../SearchBarComponent/SearchBar.component', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ onSearch, placeholder, searchValue }) => (
      <div data-testid="search-bar">
        <input
          data-testid="search-input"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
    )),
}));

// Mock getEntityChildDetailsV1 to control rendering output and inspect params
jest.mock('../../../utils/EntitySummaryPanelUtilsV1', () => ({
  getEntityChildDetailsV1: jest
    .fn()
    .mockReturnValue(<div data-testid="entity-details-content">Details</div>),
}));

const { getEntityChildDetailsV1 } = jest.requireMock(
  '../../../utils/EntitySummaryPanelUtilsV1'
);

const baseDataAsset: SearchedDataProps['data'][number]['_source'] = {
  id: '1',
  name: 'asset',
};
const baseHighlights: SearchedDataProps['data'][number]['highlight'] = {
  field: ['hit'],
};

describe('EntityDetailsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loader when loading', () => {
    render(
      <EntityDetailsSection
        isLoading
        dataAsset={baseDataAsset}
        entityType={EntityType.TABLE}
      />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('returns null when dataAsset is empty', () => {
    const { container } = render(
      <EntityDetailsSection
        dataAsset={{} as SourceType}
        entityType={EntityType.TABLE}
      />
    );

    expect(container.firstChild).toBeNull();
    expect(getEntityChildDetailsV1).toHaveBeenCalledWith(
      EntityType.TABLE,
      {},
      undefined,
      false,
      ''
    );
  });

  it('renders content from util and wraps in container class', () => {
    const { container } = render(
      <EntityDetailsSection
        dataAsset={baseDataAsset}
        entityType={EntityType.TABLE}
        highlights={baseHighlights}
      />
    );

    expect(getEntityChildDetailsV1).toHaveBeenCalledWith(
      EntityType.TABLE,
      baseDataAsset,
      baseHighlights,
      false,
      ''
    );
    expect(
      container.querySelector('.entity-details-section')
    ).toBeInTheDocument();
    expect(screen.getByTestId('entity-details-content')).toBeInTheDocument();
  });

  it('updates when memoized inputs change', () => {
    const { rerender } = render(
      <EntityDetailsSection
        dataAsset={baseDataAsset}
        entityType={EntityType.TABLE}
        highlights={baseHighlights}
      />
    );

    expect(getEntityChildDetailsV1).toHaveBeenCalledTimes(1);

    rerender(
      <EntityDetailsSection
        dataAsset={{ id: '2', name: 'asset2' }}
        entityType={EntityType.DASHBOARD}
        highlights={{ field: ['hit2'] }}
      />
    );

    expect(getEntityChildDetailsV1).toHaveBeenCalledTimes(2);
    expect(getEntityChildDetailsV1).toHaveBeenLastCalledWith(
      EntityType.DASHBOARD,
      { id: '2', name: 'asset2' },
      { field: ['hit2'] },
      false,
      ''
    );
  });

  it('should render search bar with correct placeholder', () => {
    render(
      <EntityDetailsSection
        dataAsset={baseDataAsset}
        entityType={EntityType.TABLE}
      />
    );

    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toHaveAttribute(
      'placeholder',
      'label.search-for-type'
    );
  });
});
