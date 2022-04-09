/*
 *  Copyright 2021 Collate
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
import React from 'react';
import { MemoryRouter } from 'react-router';
import SearchedData from './SearchedData';

const mockData = [
  {
    id: 'id1',
    name: 'name1',
    description: 'description1',
    fullyQualifiedName: 'fullyQualifiedName1',
    owner: 'owner1',
    tags: ['tags1', 'tags2', 'tags3'],
    tier: 'tier1',
    index: 'index1',
  },
  {
    id: 'id2',
    name: 'name2',
    description: 'description2',
    fullyQualifiedName: 'fullyQualifiedName2',
    owner: 'owner2',
    tags: ['tags1', 'tags2', 'tags3'],
    tier: 'tier2',
    index: 'index1',
  },
  {
    id: 'id3',
    name: 'name3',
    description: 'description3',
    fullyQualifiedName: 'fullyQualifiedName3',
    owner: 'owner3',
    tags: ['tags1', 'tags2', 'tags3'],
    tier: 'tier3',
    index: 'index1',
  },
];

const mockPaginate = jest.fn();

jest.mock('../common/table-data-card/TableDataCard', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="table-data-card">TableDataCard</p>);
});

jest.mock('../common/next-previous/NextPrevious', () => {
  return jest.fn().mockReturnValue(<p>Pagination</p>);
});

jest.mock('../onboarding/Onboarding', () => {
  return jest.fn().mockReturnValue(<p>Onboarding</p>);
});

jest.mock('../common/error-with-placeholder/ErrorPlaceHolderES', () => {
  return jest.fn().mockReturnValue(<p>ErrorPlaceHolderES</p>);
});

describe('Test SearchedData Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <SearchedData
        currentPage={0}
        data={mockData}
        paginate={mockPaginate}
        totalValue={10}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const searchedDataContainer = getByTestId(container, 'search-container');

    expect(searchedDataContainer).toBeInTheDocument();
  });

  it('Should display table card according to data provided in props', () => {
    const { container } = render(
      <SearchedData
        currentPage={0}
        data={mockData}
        paginate={mockPaginate}
        totalValue={10}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const searchedDataContainer = getAllByTestId(container, 'table-data-card');

    expect(searchedDataContainer.length).toBe(3);
  });

  it('If children is provided it should display', () => {
    const { container } = render(
      <SearchedData
        currentPage={0}
        data={mockData}
        paginate={mockPaginate}
        totalValue={10}>
        <p>hello world</p>
      </SearchedData>,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(getByText(container, /hello world/i)).toBeInTheDocument();
  });

  it('Pagination Should be there if data is more than 10 count', () => {
    const { container } = render(
      <SearchedData
        currentPage={0}
        data={mockData}
        paginate={mockPaginate}
        totalValue={11}>
        <p>hello world</p>
      </SearchedData>,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(getByText(container, /Pagination/i)).toBeInTheDocument();
  });

  it('Onboarding component should display if there is showOnboardingTemplate is true', () => {
    const { container } = render(
      <SearchedData
        showOnboardingTemplate
        currentPage={0}
        data={[]}
        paginate={mockPaginate}
        totalValue={0}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(getByText(container, /Onboarding/i)).toBeInTheDocument();
  });

  it('ErrorPlaceHolderES component should display if there is no data', () => {
    const { container } = render(
      <SearchedData
        currentPage={0}
        data={[]}
        paginate={mockPaginate}
        totalValue={0}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(getByText(container, /ErrorPlaceHolderES/i)).toBeInTheDocument();
  });
});
