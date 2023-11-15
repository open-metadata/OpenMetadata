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
  act,
  fireEvent,
  getByTestId,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import Searchbar from './Searchbar';

jest.useRealTimers();

jest.mock('../../../utils/SvgUtils', () => {
  return {
    __esModule: true,
    default: jest.fn().mockReturnValue(<p data-testid="svg-icon">SVGIcons</p>),
    Icons: {
      TABLE: 'table',
      TOPIC: 'topic',
      DASHBOARD: 'dashboard',
    },
  };
});

jest.mock('../../Loader/Loader', () => {
  return jest.fn().mockReturnValue(<p>Loader</p>);
});

jest.mock('lodash', () => ({
  debounce: jest.fn().mockReturnValue(jest.fn()),
}));

describe('Test Searchbar Component', () => {
  it('Renders the searchbar with the search text sent to it', async () => {
    act(() => {
      const onSearch = jest.fn();
      render(<Searchbar searchValue="Test Search" onSearch={onSearch} />);
    });
    const searchElement = screen.getByTestId('searchbar') as HTMLInputElement;

    expect(searchElement.value).toBe('Test Search');
  });

  it('Renders the searchbar with blank text if the search text is blank or not sent', () => {
    act(() => {
      const onSearch = jest.fn();
      const { container } = render(<Searchbar onSearch={onSearch} />);
      const searchElement = getByTestId(
        container,
        'searchbar'
      ) as HTMLInputElement;

      expect(searchElement.value).toBe('');
    });
  });

  it('Renders the user typed text when a change event is fired', async () => {
    const onSearch = jest.fn();

    act(() => {
      render(
        <Searchbar showLoadingStatus label="Test Label" onSearch={onSearch} />
      );
    });
    const searchElement = screen.getByTestId('searchbar') as HTMLInputElement;

    expect(searchElement.value).toBe('');
    expect(screen.getByText('Test Label')).toBeInTheDocument();

    act(() => {
      fireEvent.focus(searchElement);

      fireEvent.change(searchElement, { target: { value: 'Test Search' } });

      fireEvent.blur(searchElement);
    });

    expect(searchElement.value).toBe('Test Search');
  });

  it('Calls the callback function on keyup after timer runs out', async () => {
    const onUserSearch = jest.fn();

    await act(async () => {
      render(<Searchbar typingInterval={1000} onSearch={onUserSearch} />);
    });
    const searchElement = screen.getByTestId('searchbar') as HTMLInputElement;

    expect(searchElement.value).toBe('');

    fireEvent.change(searchElement, { target: { value: 'Test Search' } });

    expect(searchElement.value).toBe('Test Search');
  });
});
