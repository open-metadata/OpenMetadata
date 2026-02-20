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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_MEDIUM,
} from '../../../../constants/constants';
import {
  applySortToData,
  getSortField,
  getSortOrder,
} from '../../../../constants/Widgets.constant';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { getAllDataProductsWithAssetsCount } from '../../../../rest/dataProductAPI';
import { searchData } from '../../../../rest/miscAPI';
import DataProductsWidget from './DataProductsWidget.component';

const mockProps = {
  isEditView: false,
  handleRemoveWidget: jest.fn(),
  widgetKey: 'data-products-widget',
  handleLayoutUpdate: jest.fn(),
  currentLayout: [
    {
      i: 'data-products-widget',
      x: 0,
      y: 0,
      w: 2,
      h: 4,
      config: {},
    },
  ],
};

const mockDataProducts: DataProduct[] = [
  {
    id: '1',
    name: 'customer-360',
    displayName: 'Customer 360',
    fullyQualifiedName: 'customer-360',
    assets: [{ id: 'a1', type: 'table' }],
    style: { color: '#4F8CFF', iconURL: 'icon1.svg' },
    description: 'Customer data product',
  },
  {
    id: '2',
    name: 'sales-analytics',
    displayName: 'Sales Analytics',
    fullyQualifiedName: 'sales-analytics',
    assets: [
      { id: 'a2', type: 'dashboard' },
      { id: 'a3', type: 'table' },
    ],
    style: { color: '#A259FF', iconURL: 'icon2.svg' },
    description: 'Sales analytics data product',
  },
  {
    id: '3',
    name: 'marketing-insights',
    displayName: 'Marketing Insights',
    fullyQualifiedName: 'marketing-insights',
    assets: [
      { id: 'a4', type: 'dashboard' },
      { id: 'a5', type: 'pipeline' },
      { id: 'a6', type: 'table' },
    ],
    style: { color: '#FF5959', iconURL: 'icon3.svg' },
    description: 'Marketing insights data product',
  },
];

const mockSearchResponse = {
  data: {
    hits: {
      hits: mockDataProducts.map((product) => ({
        _source: product,
        _index: 'data_product_search_index',
        _id: product.id,
      })),
      total: { value: mockDataProducts.length },
    },
    aggregations: {},
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
} as any;

// Mock API functions
jest.mock('../../../../rest/miscAPI', () => ({
  searchData: jest.fn(),
}));

jest.mock('../../../../rest/dataProductAPI', () => ({
  getAllDataProductsWithAssetsCount: jest.fn(),
}));

jest.mock('../../../../constants/Widgets.constant', () => ({
  getSortField: jest.fn(),
  getSortOrder: jest.fn(),
  applySortToData: jest.fn(),
}));

jest.mock('../../../../utils/DataProductUtils', () => ({
  getDataProductIconByUrl: jest
    .fn()
    .mockReturnValue(
      React.createElement('div', { 'data-testid': 'data-product-icon' })
    ),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockGetAllDataProductsWithAssetsCount =
  getAllDataProductsWithAssetsCount as jest.MockedFunction<
    typeof getAllDataProductsWithAssetsCount
  >;

describe('DataProductsWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (searchData as jest.Mock).mockResolvedValue(mockSearchResponse);
    (getSortField as jest.Mock).mockReturnValue('updatedAt');
    (getSortOrder as jest.Mock).mockReturnValue('desc');
    (applySortToData as jest.Mock).mockImplementation((data) => data);
    mockGetAllDataProductsWithAssetsCount.mockResolvedValue({
      'customer-360': 1,
      'sales-analytics': 2,
      'marketing-insights': 3,
    });
  });

  const renderDataProductsWidget = (props = {}) => {
    return render(
      <MemoryRouter>
        <DataProductsWidget {...mockProps} {...props} />
      </MemoryRouter>
    );
  };

  it('renders widget with header', async () => {
    renderDataProductsWidget();

    expect(await screen.findByTestId('widget-header')).toBeInTheDocument();
    expect(screen.getByText('label.data-product-plural')).toBeInTheDocument();
  });

  it('renders widget wrapper', async () => {
    renderDataProductsWidget();

    expect(
      await screen.findByTestId('KnowledgePanel.DataProducts')
    ).toBeInTheDocument();
  });

  it('fetches and displays data products', async () => {
    renderDataProductsWidget();

    await waitFor(() => {
      expect(searchData).toHaveBeenCalledWith(
        '',
        1,
        PAGE_SIZE_MEDIUM,
        '',
        'updatedAt',
        'desc',
        'data_product_search_index'
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Customer 360')).toBeInTheDocument();
      expect(screen.getByText('Sales Analytics')).toBeInTheDocument();

      // Verify asset counts are displayed
      const assetCounts = screen.getAllByTestId('data-product-asset-count');

      expect(assetCounts).toHaveLength(3);
      expect(assetCounts[0]).toHaveTextContent('1');
      expect(assetCounts[1]).toHaveTextContent('2');
      expect(assetCounts[2]).toHaveTextContent('3');
    });
  });

  it('handles sort change', async () => {
    renderDataProductsWidget();

    await waitFor(() => {
      expect(searchData).toHaveBeenCalledTimes(1);
    });

    const sortButton = screen.getByTestId('widget-sort-by-dropdown');
    fireEvent.click(sortButton);

    await waitFor(() => {
      const sortOption = screen.getByText('label.a-to-z');
      fireEvent.click(sortOption);
    });

    await waitFor(() => {
      expect(searchData).toHaveBeenCalledTimes(2);
    });
  });

  it('navigates to data product details on click', async () => {
    renderDataProductsWidget();

    await waitFor(() => {
      const customerProduct = screen.getByText('Customer 360');

      expect(customerProduct).toBeInTheDocument();
    });

    const productButton = screen.getByTestId('data-product-card-1');
    fireEvent.click(productButton);

    expect(mockNavigate).toHaveBeenCalledWith('/dataProduct/customer-360');
  });

  it('renders empty state when no data products exist', async () => {
    (searchData as jest.Mock).mockResolvedValue({
      ...mockSearchResponse,
      data: {
        hits: {
          hits: [],
          total: { value: 0 },
        },
        aggregations: {},
      },
    });

    renderDataProductsWidget();

    await waitFor(() => {
      expect(
        screen.getByText('label.no-data-products-yet')
      ).toBeInTheDocument();
      expect(
        screen.getByText('message.data-products-no-data-message')
      ).toBeInTheDocument();
    });
  });

  it('renders error state when fetch fails', async () => {
    (searchData as jest.Mock).mockRejectedValue(new Error('API Error'));

    renderDataProductsWidget();

    await waitFor(() => {
      expect(
        screen.getByText('message.fetch-data-product-list-error')
      ).toBeInTheDocument();
    });
  });

  it('shows view more button when more than PAGE_SIZE_BASE products', async () => {
    const manyDataProducts = Array.from(
      { length: PAGE_SIZE_BASE + 2 },
      (_, i) => ({
        id: `${i}`,
        name: `data-product-${i}`,
        displayName: `Data Product ${i}`,
        fullyQualifiedName: `data-product-${i}`,
        assets: [],
        style: { color: '#4F8CFF' },
        description: `Data product ${i}`,
      })
    );

    const mockResponseWithMany = {
      ...mockSearchResponse,
      data: {
        hits: {
          hits: manyDataProducts.map((product) => ({
            _source: product,
            _index: 'data_product_search_index',
            _id: product.id,
          })),
          total: { value: manyDataProducts.length },
        },
        aggregations: {},
      },
    };

    (searchData as jest.Mock).mockResolvedValue(mockResponseWithMany);
    (applySortToData as jest.Mock).mockImplementation((data) => data);

    renderDataProductsWidget();

    await waitFor(() => {
      expect(screen.getByText('label.view-more')).toBeInTheDocument();
    });
  });

  it('navigates to explore page on title click', async () => {
    renderDataProductsWidget();

    await waitFor(() => {
      expect(screen.getByText('label.data-product-plural')).toBeInTheDocument();
    });

    const titleElement = screen.getByText('label.data-product-plural');
    fireEvent.click(titleElement);

    expect(mockNavigate).toHaveBeenCalledWith('/explore?tab=data_product');
  });
});
