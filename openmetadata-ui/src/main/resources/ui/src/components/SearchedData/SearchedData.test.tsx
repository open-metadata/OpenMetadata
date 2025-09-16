/*
 *  Copyright 2022 Collate.
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

import {
  getAllByTestId,
  getByTestId,
  getByText,
  render,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TAG_CONSTANT } from '../../constants/Tag.constants';
import { SearchIndex } from '../../enums/search.enum';
import SearchedData from './SearchedData';
import { SearchedDataProps } from './SearchedData.interface';

const mockData: SearchedDataProps['data'] = [
  {
    _index: SearchIndex.TABLE,
    _source: {
      id: '1',
      name: 'name1',
      description: 'description1',
      fullyQualifiedName: 'fullyQualifiedName1',
      owners: [
        {
          name: 'Customer_Support',
        },
      ],
      tags: [
        { ...TAG_CONSTANT, tagFQN: 'tags1' },
        { ...TAG_CONSTANT, tagFQN: 'tags2' },
        { ...TAG_CONSTANT, tagFQN: 'tags3' },
      ],
      tier: {
        ...TAG_CONSTANT,
        tagFQN: 'tier1',
      },
    },
    highlight: {
      name: ['raw_<span class="text-highlighter">customer</span>'],
      displayName: ['raw_<span class="text-highlighter">customer</span>'],
      'name.ngram': ['raw_<span class="text-highlighter">customer</span>'],
      'displayName.ngram': [
        'raw_<span class="text-highlighter">customer</span>',
      ],
    },
  },
  {
    _index: SearchIndex.TABLE,
    _source: {
      id: '2',
      name: 'name2',
      description: 'description2',
      fullyQualifiedName: 'fullyQualifiedName2',
      owners: [{ name: 'owner2' }],
      tags: [
        { ...TAG_CONSTANT, tagFQN: 'tags1' },
        { ...TAG_CONSTANT, tagFQN: 'tags2' },
        { ...TAG_CONSTANT, tagFQN: 'tags3' },
      ],
      tier: { ...TAG_CONSTANT, tagFQN: 'tier2' },
    },
  },
  {
    _index: SearchIndex.TABLE,
    _source: {
      id: '3',
      name: 'name3',
      description: 'description3',
      fullyQualifiedName: 'fullyQualifiedName3',
      owners: [{ name: 'owner3' }],
      tags: [
        { ...TAG_CONSTANT, tagFQN: 'tags1' },
        { ...TAG_CONSTANT, tagFQN: 'tags2' },
        { ...TAG_CONSTANT, tagFQN: 'tags3' },
      ],
      tier: { ...TAG_CONSTANT, tagFQN: 'tier3' },
    },
  },
];

const mockPaginate = jest.fn();
const mockHandleSummaryPanelDisplay = jest.fn();

jest.mock('../Database/TableDataCardBody/TableDataCardBody', () => {
  return jest.fn().mockReturnValue(<p>TableDataCardBody</p>);
});

jest.mock('../common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockReturnValue(<p>Pagination</p>);
});

jest.mock('../common/ErrorWithPlaceholder/ErrorPlaceHolderES', () => {
  return jest.fn().mockReturnValue(<p>ErrorPlaceHolderES</p>);
});

const MOCK_PROPS = {
  isFilterSelected: false,
  isSummaryPanelVisible: false,
  currentPage: 0,
  data: mockData,
  handleSummaryPanelDisplay: mockHandleSummaryPanelDisplay,
  onPaginationChange: mockPaginate,
  selectedEntityId: 'name1',
  totalValue: 10,
};

describe('Test SearchedData Component', () => {
  it('Component should render', () => {
    const { container } = render(<SearchedData {...MOCK_PROPS} />, {
      wrapper: MemoryRouter,
    });

    const searchedDataContainer = getByTestId(container, 'search-container');

    expect(searchedDataContainer).toBeInTheDocument();
  });

  it('Should display table card according to data provided in props', () => {
    const { container } = render(<SearchedData {...MOCK_PROPS} />, {
      wrapper: MemoryRouter,
    });
    const card1 = getByTestId(container, 'table-data-card_fullyQualifiedName1');
    const card2 = getByTestId(container, 'table-data-card_fullyQualifiedName2');
    const card3 = getByTestId(container, 'table-data-card_fullyQualifiedName3');

    expect(card1).toBeInTheDocument();
    expect(card2).toBeInTheDocument();
    expect(card3).toBeInTheDocument();
  });

  it('Should display table card with name and display name highlighted', () => {
    const { container } = render(<SearchedData {...MOCK_PROPS} />, {
      wrapper: MemoryRouter,
    });

    const card1 = getByTestId(container, 'table-data-card_fullyQualifiedName1');
    const card2 = getByTestId(container, 'table-data-card_fullyQualifiedName2');
    const card3 = getByTestId(container, 'table-data-card_fullyQualifiedName3');

    expect(card1).toBeInTheDocument();
    expect(card2).toBeInTheDocument();
    expect(card3).toBeInTheDocument();

    const headerDisplayName = getAllByTestId(
      container,
      'entity-header-display-name'
    );

    expect(headerDisplayName[0].querySelector('span')).toHaveClass(
      'text-highlighter'
    );
  });

  it('If children is provided it should display', () => {
    const { container } = render(
      <SearchedData {...MOCK_PROPS}>
        <p>hello world</p>
      </SearchedData>,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(getByText(container, /hello world/i)).toBeInTheDocument();
  });

  it('ErrorPlaceHolderES component should display if there is no data', () => {
    const { container } = render(
      <SearchedData {...MOCK_PROPS} data={[]} totalValue={0} />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(getByText(container, /ErrorPlaceHolderES/i)).toBeInTheDocument();
  });

  it('Component should render highlights', () => {
    const { container } = render(<SearchedData {...MOCK_PROPS} />, {
      wrapper: MemoryRouter,
    });

    const searchedDataContainer = getByTestId(container, 'search-container');

    expect(searchedDataContainer).toBeInTheDocument();
    expect(getByTestId(container, 'matches-stats')).toHaveTextContent(
      'label.matches:1 in Name,1 in Display Name'
    );
  });
});
