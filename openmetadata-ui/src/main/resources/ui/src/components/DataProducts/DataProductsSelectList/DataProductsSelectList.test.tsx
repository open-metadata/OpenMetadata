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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { DataProductSelectOption } from './DataProductSelectList.interface';
import DataProductsSelectList from './DataProductsSelectList';

const option = (name: string): DataProductSelectOption => ({
  label: name,
  value: { id: name, name, displayName: name, fullyQualifiedName: name },
});
const response = (name: string) => ({
  data: [option(name)],
  paging: { total: 3 },
});

beforeEach(() => jest.useFakeTimers());

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('refreshes the active query when the fetch function changes', async () => {
  let completeOld!: (value: ReturnType<typeof response>) => void;
  const oldResponse = new Promise<ReturnType<typeof response>>((resolve) => {
    completeOld = resolve;
  });
  const { container, rerender } = render(
    <DataProductsSelectList fetchOptions={() => oldResponse} />
  );
  await act(async () => {
    fireEvent.focus(screen.getByRole('combobox'));
  });
  const selector = container.querySelector('.ant-select-selector');
  if (!selector) {
    throw new Error('Data product selector is missing');
  }
  fireEvent.mouseDown(selector);
  await act(async () => {
    rerender(
      <DataProductsSelectList
        fetchOptions={() => Promise.resolve(response('New scope'))}
      />
    );
  });

  expect(screen.getByTestId('tag-New scope')).toBeInTheDocument();

  await act(async () => {
    completeOld(response('Old scope'));
  });

  expect(screen.queryByTestId('tag-Old scope')).not.toBeInTheDocument();
  expect(screen.getByTestId('tag-New scope')).toBeInTheDocument();
});

for (const lateResponse of ['initial-search', 'pagination']) {
  it(
    'keeps current results when an older ' + lateResponse + ' completes',
    async () => {
      let completeOld!: (value: ReturnType<typeof response>) => void;
      const older = new Promise<ReturnType<typeof response>>((resolve) => {
        completeOld = resolve;
      });
      const fetchOptions = jest.fn((query: string, page: number) => {
        if (query === 'fresh') {
          return Promise.resolve(response('Fresh product'));
        }
        if (lateResponse === 'initial-search' || page > 1) {
          return older;
        }

        return Promise.resolve(response('Initial product'));
      });
      const { container } = render(
        <DataProductsSelectList
          debounceTimeout={10}
          fetchOptions={fetchOptions}
        />
      );
      const input = screen.getByRole('combobox');
      await act(async () => {
        fireEvent.focus(input);
      });
      const selector = container.querySelector('.ant-select-selector');
      if (!selector) {
        throw new Error('Data product selector is missing');
      }
      fireEvent.mouseDown(selector);
      if (lateResponse === 'pagination') {
        await act(async () => {
          const list = document.querySelector('.rc-virtual-list-holder');
          if (!list) {
            throw new Error('Data product dropdown is missing');
          }
          fireEvent.scroll(list);
        });

        expect(fetchOptions).toHaveBeenCalledWith('', 2);
      }
      fireEvent.change(input, { target: { value: 'fresh' } });
      await act(async () => {
        jest.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('tag-Fresh product')).toBeInTheDocument();

      await act(async () => {
        completeOld(response('Stale product'));
      });

      expect(screen.getByTestId('tag-Fresh product')).toBeInTheDocument();
      expect(screen.queryByTestId('tag-Stale product')).not.toBeInTheDocument();
    }
  );
}
