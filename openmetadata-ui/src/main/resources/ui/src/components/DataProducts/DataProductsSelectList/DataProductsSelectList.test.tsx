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

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { showErrorToast } from '../../../utils/ToastUtils';
import { DataProductSelectOption } from './DataProductSelectList.interface';
import DataProductsSelectList from './DataProductsSelectList';

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const option = (name: string, domain = 'Sales'): DataProductSelectOption => ({
  label: name,
  value: {
    id: `${name}-id`,
    name,
    displayName: name,
    fullyQualifiedName: name,
    description: '',
    domains: [{ id: 'd-1', name: domain, type: 'domain' }],
  },
});

const renderPicker = (
  props: Partial<React.ComponentProps<typeof DataProductsSelectList>> = {}
) => {
  const onSubmit = jest.fn();
  const fetchOptions = jest
    .fn()
    .mockResolvedValue({ data: [option('dp1')], paging: { total: 1 } });

  render(
    <DataProductsSelectList
      isOpen
      fetchOptions={fetchOptions}
      selectedDataProducts={[]}
      onOpenChange={jest.fn()}
      onSubmit={onSubmit}
      {...props}>
      <button type="button">Edit</button>
    </DataProductsSelectList>
  );

  return { fetchOptions, onSubmit };
};

describe('DataProductsSelectList', () => {
  it('shows each data product with its domain underneath', async () => {
    const { fetchOptions } = renderPicker();

    const row = await screen.findByTestId('dp1');

    expect(within(row).getByText('dp1')).toBeInTheDocument();
    expect(within(row).getByText('Sales')).toBeInTheDocument();
    expect(fetchOptions).toHaveBeenCalledWith('', 1);
  });

  it('loads the next page when the list is scrolled to its end', async () => {
    const fetchOptions = jest
      .fn()
      .mockImplementation(async (_search: string, page: number) =>
        page === 1
          ? { data: [option('dp1')], paging: { total: 2 } }
          : { data: [option('dp2')], paging: { total: 2 } }
      );
    renderPicker({ fetchOptions });

    await screen.findByTestId('dp1');
    const menu = screen.getByRole('menu');
    Object.defineProperties(menu, {
      scrollHeight: { configurable: true, value: 400 },
      clientHeight: { configurable: true, value: 200 },
    });
    menu.scrollTop = 200;
    fireEvent.scroll(menu);

    expect(await screen.findByTestId('dp2')).toBeInTheDocument();
    expect(fetchOptions).toHaveBeenLastCalledWith('', 2);
  });

  it('submits the picked data products on Apply', async () => {
    const { onSubmit } = renderPicker();

    fireEvent.click(await screen.findByTestId('dp1'));
    fireEvent.click(screen.getByTestId('update-btn'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'dp1-id', fullyQualifiedName: 'dp1' }),
      ])
    );
  });

  it('drops the previous results when a search fails', async () => {
    const fetchOptions = jest
      .fn()
      .mockResolvedValueOnce({ data: [option('dp1')], paging: { total: 1 } })
      .mockRejectedValueOnce(new Error('search failed'));
    renderPicker({ fetchOptions, debounceTimeout: 0 });

    await screen.findByTestId('dp1');
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'dp' },
    });

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(screen.queryByTestId('dp1')).not.toBeInTheDocument();
  });

  it('requests the next page once, however many scroll events arrive', async () => {
    let finishPage2!: (value: unknown) => void;
    const fetchOptions = jest
      .fn()
      .mockImplementation((_search: string, page: number) =>
        page === 1
          ? Promise.resolve({ data: [option('dp1')], paging: { total: 2 } })
          : new Promise((resolve) => {
              finishPage2 = resolve;
            })
      );
    renderPicker({ fetchOptions });

    await screen.findByTestId('dp1');
    const menu = screen.getByRole('menu');
    Object.defineProperties(menu, {
      scrollHeight: { configurable: true, value: 400 },
      clientHeight: { configurable: true, value: 200 },
    });
    menu.scrollTop = 200;
    fireEvent.scroll(menu);
    fireEvent.scroll(menu);
    fireEvent.scroll(menu);

    expect(
      fetchOptions.mock.calls.filter(([, page]) => page === 2)
    ).toHaveLength(1);

    finishPage2({ data: [option('dp2')], paging: { total: 2 } });

    expect(await screen.findByTestId('dp2')).toBeInTheDocument();
  });
});
