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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createRef, useCallback, useState } from 'react';
import { Paging } from '../../../../generated/type/paging';
import {
  usePaging,
  UsePagingInterface,
} from '../../../../hooks/paging/usePaging';
import { MOCK_PERMISSIONS } from '../../../../mocks/Glossary.mock';
import { searchQuery } from '../../../../rest/searchAPI';
import DataProductsTab from './DataProductsTab.component';
import { DataProductsTabRef } from './DataProductsTab.interface';

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'Commerce' }),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel }) => firstPanel.children)
);

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => <div data-testid="error-placeholder" />),
}));

jest.mock('../../../ExploreV1/ExploreSearchCard/ExploreSearchCard', () =>
  jest
    .fn()
    .mockImplementation(({ hideBreadcrumbs }) => (
      <div data-hide-breadcrumbs={hideBreadcrumbs} data-testid="data-product" />
    ))
);

jest.mock('../../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.Mock;
const mockUsePaging = usePaging as jest.Mock;

const buildHit = (i: number) => ({
  _source: {
    id: `dp-${i}`,
    name: `dp${i}`,
    fullyQualifiedName: `Commerce.dp${i}`,
    domains: [{ fullyQualifiedName: 'Commerce', type: 'domain' }],
  },
});
const buildHits = (count: number) =>
  Array.from({ length: count }, (_, i) => buildHit(i));

const mockResponse = (hitsCount: number, total: number) => ({
  hits: { hits: buildHits(hitsCount), total: { value: total } },
});

const useFakePaging = (): UsePagingInterface => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [paging, setPaging] = useState<Paging>({
    after: '',
    before: '',
    total: 0,
  });

  const handlePageChange = useCallback(
    (page: number | ((page: number) => number)) => {
      setCurrentPage((prev) =>
        typeof page === 'function' ? page(prev) : page
      );
    },
    []
  );
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);
  const handlePagingChange = setPaging;

  return {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination: paging.total > pageSize,
    pagingCursor: {},
  };
};

describe('DataProductsTab', () => {
  beforeEach(() => {
    mockUsePaging.mockImplementation(useFakePaging);
    mockSearchQuery.mockResolvedValue(mockResponse(1, 1));
  });

  it('hides redundant domain breadcrumbs in the domain data product list', async () => {
    render(
      <DataProductsTab
        permissions={MOCK_PERMISSIONS}
        onAddDataProduct={jest.fn()}
      />
    );

    expect(await screen.findByTestId('data-product')).toHaveAttribute(
      'data-hide-breadcrumbs',
      'true'
    );
  });

  it('drives the search request from the paging hook instead of a hardcoded page', async () => {
    render(
      <DataProductsTab
        permissions={MOCK_PERMISSIONS}
        onAddDataProduct={jest.fn()}
      />
    );

    await waitFor(() => expect(mockSearchQuery).toHaveBeenCalled());

    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ pageNumber: 1, pageSize: 15 })
    );
  });

  it('renders a paging control when total Data Products exceed the visible page', async () => {
    mockSearchQuery.mockResolvedValue(mockResponse(50, 73));

    render(
      <DataProductsTab
        permissions={MOCK_PERMISSIONS}
        onAddDataProduct={jest.fn()}
      />
    );

    expect(await screen.findByRole('navigation')).toBeInTheDocument();
  });

  it('reflects the fetched total in the paging control', async () => {
    mockSearchQuery.mockResolvedValue(mockResponse(15, 73));

    render(
      <DataProductsTab
        permissions={MOCK_PERMISSIONS}
        onAddDataProduct={jest.fn()}
      />
    );

    expect(await screen.findByTestId('page-indicator')).toHaveTextContent(
      'label.page 1 label.of 5'
    );
  });

  it('requests the next page when the user pages forward', async () => {
    mockSearchQuery.mockResolvedValue(mockResponse(15, 73));

    render(
      <DataProductsTab
        permissions={MOCK_PERMISSIONS}
        onAddDataProduct={jest.fn()}
      />
    );

    const next = await screen.findByTestId('next');
    fireEvent.click(next);

    await waitFor(() =>
      expect(mockSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ pageNumber: 2 })
      )
    );
  });

  it('renders the empty state without a paging control when there are no Data Products', async () => {
    mockSearchQuery.mockResolvedValue(mockResponse(0, 0));

    render(
      <DataProductsTab
        permissions={MOCK_PERMISSIONS}
        onAddDataProduct={jest.fn()}
      />
    );

    expect(await screen.findByTestId('error-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
  });

  it('refetches the first page when refreshed from a later page', async () => {
    mockSearchQuery.mockResolvedValue(mockResponse(15, 73));
    const ref = createRef<DataProductsTabRef>();

    render(
      <DataProductsTab
        permissions={MOCK_PERMISSIONS}
        ref={ref}
        onAddDataProduct={jest.fn()}
      />
    );

    const next = await screen.findByTestId('next');
    fireEvent.click(next);
    await waitFor(() =>
      expect(mockSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ pageNumber: 2 })
      )
    );

    act(() => {
      ref.current?.refreshDataProducts();
    });

    await waitFor(() =>
      expect(mockSearchQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ pageNumber: 1 })
      )
    );
  });
});
