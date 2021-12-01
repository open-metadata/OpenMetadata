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

import { fireEvent, getByTestId, render } from '@testing-library/react';
import React from 'react';
import Searchbar from './Searchbar';

describe('Test Searchbar Component', () => {
  it('Renders the searchbar with the search text sent to it', () => {
    const onSearch = jest.fn();
    const { container } = render(
      <Searchbar searchValue="Test Search" onSearch={onSearch} />
    );
    const searchElement = getByTestId(container, 'searchbar');

    expect(searchElement.value).toBe('Test Search');
  });

  it('Renders the searchbar with blank text if the search text is blank or not sent', () => {
    const onSearch = jest.fn();
    const { container } = render(<Searchbar onSearch={onSearch} />);
    const searchElement = getByTestId(container, 'searchbar');

    expect(searchElement.value).toBe('');
  });

  it('Renders the user typed text when a change event is fired', () => {
    const onSearch = jest.fn();
    const { container } = render(<Searchbar onSearch={onSearch} />);
    const searchElement = getByTestId(container, 'searchbar');

    expect(searchElement.value).toBe('');

    fireEvent.change(searchElement, { target: { value: 'Test Search' } });

    expect(searchElement.value).toBe('Test Search');
  });

  it('Calls the callback function on keyup after timer runs out', async () => {
    const onUserSearch = jest.fn();
    const { container } = render(
      <Searchbar typingInterval={1000} onSearch={onUserSearch} />
    );
    const searchElement = getByTestId(container, 'searchbar');

    expect(searchElement.value).toBe('');

    fireEvent.change(searchElement, { target: { value: 'Test Search' } });
    await new Promise((r) => setTimeout(r, 1000));

    expect(onUserSearch).toBeCalled();
    expect(searchElement.value).toBe('Test Search');
  });
});
