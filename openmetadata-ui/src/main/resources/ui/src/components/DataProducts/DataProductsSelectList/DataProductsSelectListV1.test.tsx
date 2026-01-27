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
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { SelectableListProps } from '../../common/SelectableList/SelectableList.interface';
import { DataProductsSelectListV1 } from './DataProductsSelectListV1';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../assets/svg/ic-data-product.svg', () => ({
  ReactComponent: () => <div data-testid="data-product-icon">DP</div>,
}));

const mockSelectableList = jest
  .fn()
  .mockImplementation(
    ({
      onUpdate,
      onCancel,
      selectedItems,
    }: {
      onUpdate?: (items: DataProduct[]) => void;
      onCancel?: () => void;
      selectedItems?: DataProduct[];
    }) => (
      <div data-testid="selectable-list">
        <div data-testid="selected-count">{selectedItems?.length || 0}</div>
        <button
          data-testid="update-button"
          onClick={() =>
            onUpdate?.([
              {
                id: 'dp1',
                name: 'DataProduct1',
                displayName: 'Data Product 1',
                fullyQualifiedName: 'domain.DataProduct1',
                description: 'Test data product',
              },
            ])
          }>
          Update
        </button>
        <button data-testid="cancel-button" onClick={() => onCancel?.()}>
          Cancel
        </button>
      </div>
    )
  );

jest.mock(
  '../../../components/common/SelectableList/SelectableList.component',
  () => ({
    SelectableList: (props: SelectableListProps) => mockSelectableList(props),
  })
);

jest.mock(
  '../../../components/common/FocusTrap/FocusTrapWithContainer',
  () => ({
    FocusTrapWithContainer: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  })
);

const mockDataProducts: DataProduct[] = [
  {
    id: 'dp1',
    name: 'DataProduct1',
    displayName: 'Data Product 1',
    fullyQualifiedName: 'domain.DataProduct1',
    description: 'Test data product',
  } as DataProduct,
];

const mockFetchOptions = jest.fn();
const mockOnUpdate = jest.fn();
const mockOnCancel = jest.fn();

const defaultProps = {
  selectedDataProducts: mockDataProducts,
  onUpdate: mockOnUpdate,
  onCancel: mockOnCancel,
  fetchOptions: mockFetchOptions,
  children: <button data-testid="trigger-button">Open</button>,
  popoverProps: {},
};

describe('DataProductsSelectListV1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchOptions.mockResolvedValue({
      data: [
        {
          label: 'Data Product 2',
          value: {
            id: 'dp2',
            name: 'DataProduct2',
            displayName: 'Data Product 2',
            fullyQualifiedName: 'domain.DataProduct2',
            description: 'Test data product 2',
          },
        },
      ],
      paging: { total: 1 },
    });
  });

  it('should render the trigger children', () => {
    render(<DataProductsSelectListV1 {...defaultProps} />);

    expect(screen.getByTestId('trigger-button')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('should open popover when trigger is clicked', async () => {
    render(<DataProductsSelectListV1 {...defaultProps} />);

    const trigger = screen.getByTestId('trigger-button');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
    });
  });

  it('should pass selected data products count to SelectableList', async () => {
    render(<DataProductsSelectListV1 {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
    });
  });

  it('should call onUpdate with converted data products when update is clicked', async () => {
    render(<DataProductsSelectListV1 {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('update-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('update-button'));

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'dp1',
          name: 'DataProduct1',
          displayName: 'Data Product 1',
          fullyQualifiedName: 'domain.DataProduct1',
        }),
      ]);
    });
  });

  it('should close popover after successful update', async () => {
    render(<DataProductsSelectListV1 {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('update-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('update-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('selectable-list')).not.toBeInTheDocument();
    });
  });

  it('should call onCancel when cancel is clicked', async () => {
    render(<DataProductsSelectListV1 {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('cancel-button'));

    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  it('should fetch data products with pagination', async () => {
    mockFetchOptions.mockResolvedValue({
      data: [
        {
          label: 'DP1',
          value: {
            id: 'dp1',
            name: 'DP1',
            fullyQualifiedName: 'domain.DP1',
          },
        },
        {
          label: 'DP2',
          value: {
            id: 'dp2',
            name: 'DP2',
            fullyQualifiedName: 'domain.DP2',
          },
        },
      ],
      paging: { total: 20 },
    });

    render(<DataProductsSelectListV1 {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(mockSelectableList).toHaveBeenCalled();
    });

    const fetchOptions = mockSelectableList.mock.calls[0][0].fetchOptions;
    const result = await fetchOptions('test', '1');

    expect(mockFetchOptions).toHaveBeenCalledWith('test', 1);
    expect(result.data).toHaveLength(2);
    expect(result.paging.total).toBe(20);
  });

  it('should handle empty data products list', () => {
    render(
      <DataProductsSelectListV1 {...defaultProps} selectedDataProducts={[]} />
    );

    expect(screen.getByTestId('trigger-button')).toBeInTheDocument();
  });

  it('should handle fetch errors gracefully', async () => {
    mockFetchOptions.mockRejectedValue(new Error('Network error'));

    render(<DataProductsSelectListV1 {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(mockSelectableList).toHaveBeenCalled();
    });

    const fetchOptions = mockSelectableList.mock.calls[0][0].fetchOptions;
    const result = await fetchOptions('test', '1');

    expect(result.data).toEqual([]);
    expect(result.paging.total).toBe(0);
  });

  it('should calculate pagination after correctly', async () => {
    mockFetchOptions.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => ({
        label: `DP${i}`,
        value: {
          id: `dp${i}`,
          name: `DP${i}`,
          fullyQualifiedName: `domain.DP${i}`,
        },
      })),
      paging: { total: 50 },
    });

    render(<DataProductsSelectListV1 {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(mockSelectableList).toHaveBeenCalled();
    });

    const fetchOptions = mockSelectableList.mock.calls[0][0].fetchOptions;
    const result = await fetchOptions('test', '1');

    expect(result.paging.after).toBe('2');
  });

  it('should not return after when all items are fetched', async () => {
    mockFetchOptions.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => ({
        label: `DP${i}`,
        value: {
          id: `dp${i}`,
          name: `DP${i}`,
          fullyQualifiedName: `domain.DP${i}`,
        },
      })),
      paging: { total: 10 },
    });

    render(<DataProductsSelectListV1 {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(mockSelectableList).toHaveBeenCalled();
    });

    const fetchOptions = mockSelectableList.mock.calls[0][0].fetchOptions;
    const result = await fetchOptions('test', '1');

    expect(result.paging.after).toBeUndefined();
  });

  it('should use popoverProps when provided', () => {
    const customPopoverProps = {
      placement: 'bottomRight' as const,
      open: true,
      onOpenChange: jest.fn(),
    };

    render(
      <DataProductsSelectListV1
        {...defaultProps}
        popoverProps={customPopoverProps}
      />
    );

    expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
  });
});
