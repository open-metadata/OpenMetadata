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

import { findByTestId, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import AdvanceSearch from './AdvanceSearch';

jest.mock('../../utils/RouterUtils', () => ({
  inPageSearchOptions: jest.fn(),
  isInPageSearchAllowed: jest.fn(),
}));

jest.mock('./InputSearch', () => {
  return jest.fn().mockReturnValue(<p>InputSearch</p>);
});

jest.mock('./InputText', () => {
  return jest.fn().mockReturnValue(<p>InputText</p>);
});

jest.mock('react-markdown', () => {
  return jest.fn();
});

jest.mock('rehype-raw', () => {
  return jest.fn();
});

jest.mock('remark-gfm', () => {
  return jest.fn();
});

const handleOnClick = jest.fn();

const mockProp = {
  searchValue: ' ',
  isSearchBoxOpen: false,
  isTourRoute: false,
  pathname: '/',
  handleOnClick,
  handleSearchChange: jest.fn(),
  handleKeyDown: jest.fn(),
  handleSearchBoxOpen: jest.fn(),
  onFilterChange: jest.fn(),
};

describe('Test Advance Search Component', () => {
  it('Should render child elements', async () => {
    const { container } = render(<AdvanceSearch {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const filterWrapper = await findByTestId(container, 'filter-wrapper');

    const searchWrapper = await findByTestId(container, 'search-wrapper');

    const searchButton = await findByTestId(container, 'search-button');

    expect(filterWrapper).toBeInTheDocument();

    expect(searchWrapper).toBeInTheDocument();

    expect(searchButton).toBeInTheDocument();
  });

  it('Should call handleOnClick when search search button is clicked', async () => {
    const { container } = render(<AdvanceSearch {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const searchButton = await findByTestId(container, 'search-button');

    expect(searchButton).toBeInTheDocument();

    fireEvent(
      searchButton,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    expect(handleOnClick).toBeCalled();
  });
});
