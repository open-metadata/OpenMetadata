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
import { act, fireEvent, render, screen } from '@testing-library/react';
import Searchbar from './SearchBar.component';

jest.mock('../Loader/Loader', () => jest.fn().mockReturnValue(<p>Loader</p>));

describe('Searchbar debounce (real lodash debounce)', () => {
  it('searches once the typing interval has passed', () => {
    const onSearch = jest.fn();
    render(<Searchbar typingInterval={500} onSearch={onSearch} />);

    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: 'orders' },
    });

    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onSearch).toHaveBeenCalledWith('orders');
  });

  it('keeps a pending search when the parent re-renders with a new onSearch', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = render(
      <Searchbar typingInterval={500} onSearch={first} />
    );

    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: 'orders' },
    });
    rerender(<Searchbar typingInterval={500} onSearch={second} />);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect([...first.mock.calls, ...second.mock.calls]).toEqual([['orders']]);
  });

  it('drops a pending search when the bar unmounts', () => {
    const onSearch = jest.fn();
    const { unmount } = render(
      <Searchbar typingInterval={500} onSearch={onSearch} />
    );

    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: 'orders' },
    });
    unmount();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onSearch).not.toHaveBeenCalled();
  });
});
