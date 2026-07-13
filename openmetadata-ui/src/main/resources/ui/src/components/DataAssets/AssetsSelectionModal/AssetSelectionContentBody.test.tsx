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
import { fireEvent, render, screen } from '@testing-library/react';
import AssetSelectionContentBody, {
  AssetSelectionContentBodyProps,
} from './AssetSelectionContentBody';

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    onScroll,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    onScroll?: () => void;
    'data-testid'?: string;
  }) => (
    <div data-testid={testId} onScroll={onScroll}>
      {children}
    </div>
  ),
  Divider: () => <div data-testid="divider" />,
  Typography: ({
    children,
    onClick,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    'data-testid'?: string;
  }) => (
    <span data-testid={testId} onClick={onClick}>
      {children}
    </span>
  ),
}));

jest.mock('../../common/Banner/Banner', () => {
  return jest.fn(({ type, message }: { type: string; message: string }) => (
    <div data-testid="banner" data-type={type}>
      {message}
    </div>
  ));
});

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-placeholder">{children}</div>
  ));
});

jest.mock('../../common/Loader/Loader', () => {
  return jest.fn(() => <div data-testid="loader" />);
});

jest.mock('../../common/SearchBarComponent/SearchBar.component', () => {
  return jest.fn(
    ({
      searchValue,
      onSearch,
    }: {
      searchValue: string;
      onSearch: (value: string) => void;
    }) => (
      <input
        data-testid="search-bar"
        value={searchValue}
        onChange={(e) => onSearch(e.target.value)}
      />
    )
  );
});

jest.mock('../../common/TableDataCardV2/TableDataCardV2', () => {
  return jest.fn(
    ({
      id,
      checked,
      source,
      handleSummaryPanelDisplay,
    }: {
      id: string;
      checked?: boolean;
      source: { id?: string };
      handleSummaryPanelDisplay?: (source: unknown) => void;
    }) => (
      <div data-checked={checked ? 'true' : 'false'} data-testid={id}>
        <button
          data-testid={`${id}-select`}
          onClick={() => handleSummaryPanelDisplay?.(source)}>
          select
        </button>
      </div>
    )
  );
});

jest.mock('../../Explore/ExploreQuickFilters', () => {
  return jest.fn(() => <div data-testid="explore-quick-filters" />);
});

jest.mock(
  '../DomainAssetDryRunModal/DomainAssetDryRunModal.component',
  () => {
    return jest.fn(
      ({
        visible,
        onConfirm,
        onCancel,
      }: {
        visible: boolean;
        onConfirm: () => void;
        onCancel: () => void;
      }) =>
        visible ? (
          <div data-testid="dry-run-modal">
            <button data-testid="dry-run-confirm" onClick={onConfirm}>
              confirm
            </button>
            <button data-testid="dry-run-cancel" onClick={onCancel}>
              cancel
            </button>
          </div>
        ) : null
    );
  }
);

const mockSetSearch = jest.fn();
const mockHandleCardClick = jest.fn();
const mockConfirmDomainAssetMove = jest.fn();
const mockCancelDomainAssetMove = jest.fn();
const mockOnScroll = jest.fn();
const mockOnSelectAll = jest.fn();
const mockGetErrorStatusAndMessage = jest
  .fn()
  .mockReturnValue({ isError: false, errorMessage: null });
const mockHandleQuickFiltersValueSelect = jest.fn();
const mockClearFilters = jest.fn();

const buildItem = (id: string) => ({
  _id: id,
  _index: 'index',
  _source: { id, name: id },
});

const defaultProps: AssetSelectionContentBodyProps = {
  search: '',
  setSearch: mockSetSearch,
  items: [],
  failedStatus: undefined,
  dryRunWarnings: undefined,
  exportJob: undefined,
  selectedItems: new Map(),
  isLoading: false,
  isSaveLoading: false,
  assetJobResponse: undefined,
  aggregations: undefined,
  quickFilterQuery: undefined,
  filters: [],
  totalCount: 0,
  handleCardClick: mockHandleCardClick,
  confirmDomainAssetMove: mockConfirmDomainAssetMove,
  cancelDomainAssetMove: mockCancelDomainAssetMove,
  onScroll: mockOnScroll,
  onSelectAll: mockOnSelectAll,
  getErrorStatusAndMessage: mockGetErrorStatusAndMessage,
  handleQuickFiltersValueSelect: mockHandleQuickFiltersValueSelect,
  clearFilters: mockClearFilters,
} as unknown as AssetSelectionContentBodyProps;

describe('AssetSelectionContentBody', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetErrorStatusAndMessage.mockReturnValue({
      isError: false,
      errorMessage: null,
    });
  });

  it('should show error banner when exportJob has an error', () => {
    render(
      <AssetSelectionContentBody
        {...defaultProps}
        exportJob={{ error: 'export failed' } as never}
      />
    );

    expect(screen.getByTestId('banner')).toHaveAttribute('data-type', 'error');
  });

  it('should show success/loading banner when assetJobResponse is present without export error', () => {
    render(
      <AssetSelectionContentBody
        {...defaultProps}
        assetJobResponse={{ message: 'job started' } as never}
      />
    );

    expect(screen.getByTestId('banner')).toHaveAttribute(
      'data-type',
      'success'
    );
  });

  it('should not show banner when no exportJob or assetJobResponse', () => {
    render(<AssetSelectionContentBody {...defaultProps} />);

    expect(screen.queryByTestId('banner')).not.toBeInTheDocument();
  });

  it('should render info banner when infoBannerText is provided', () => {
    render(
      <AssetSelectionContentBody
        {...defaultProps}
        infoBannerText="some info"
      />
    );

    expect(screen.getByText('some info')).toBeInTheDocument();
  });

  it('should call setSearch when search bar value changes', () => {
    render(<AssetSelectionContentBody {...defaultProps} />);

    fireEvent.change(screen.getByTestId('search-bar'), {
      target: { value: 'new search' },
    });

    expect(mockSetSearch).toHaveBeenCalledWith('new search');
  });

  it('should not render clear-filters when quickFilterQuery is undefined', () => {
    render(<AssetSelectionContentBody {...defaultProps} />);

    expect(screen.queryByTestId('clear-filters')).not.toBeInTheDocument();
  });

  it('should render clear-filters and call clearFilters when quickFilterQuery is set', () => {
    render(
      <AssetSelectionContentBody
        {...defaultProps}
        quickFilterQuery={{} as never}
      />
    );

    fireEvent.click(screen.getByTestId('clear-filters'));

    expect(mockClearFilters).toHaveBeenCalledTimes(1);
  });

  it('should show validation error alert when failedStatus has failed requests', () => {
    render(
      <AssetSelectionContentBody
        {...defaultProps}
        failedStatus={
          {
            failedRequest: [{ request: { id: '1' }, message: 'failed' }],
          } as never
        }
      />
    );

    expect(
      screen.getByText('label.validation-error-plural')
    ).toBeInTheDocument();
  });

  it('should not show validation error alert when failedStatus has no failed requests', () => {
    render(
      <AssetSelectionContentBody
        {...defaultProps}
        failedStatus={{ failedRequest: [] } as never}
      />
    );

    expect(
      screen.queryByText('label.validation-error-plural')
    ).not.toBeInTheDocument();
  });

  it('should render a card per item and select-all checkbox when items exist', () => {
    const items = [buildItem('1'), buildItem('2')];

    render(
      <AssetSelectionContentBody {...defaultProps} items={items as never} />
    );

    expect(screen.getByTestId('tabledatacard-1')).toBeInTheDocument();
    expect(screen.getByTestId('tabledatacard-2')).toBeInTheDocument();
    expect(screen.getByText('label.select-field')).toBeInTheDocument();
  });

  it('should mark a card as checked when its id is in selectedItems', () => {
    const items = [buildItem('1')];
    const selectedItems = new Map([['1', { id: '1' }]]) as never;

    render(
      <AssetSelectionContentBody
        {...defaultProps}
        items={items as never}
        selectedItems={selectedItems}
      />
    );

    expect(screen.getByTestId('tabledatacard-1')).toHaveAttribute(
      'data-checked',
      'true'
    );
  });

  it('should call handleCardClick when a card is selected', () => {
    const items = [buildItem('1')];

    render(
      <AssetSelectionContentBody {...defaultProps} items={items as never} />
    );

    fireEvent.click(screen.getByTestId('tabledatacard-1-select'));

    expect(mockHandleCardClick).toHaveBeenCalled();
  });

  it('should call onSelectAll with true when select-all checkbox is checked', () => {
    const items = [buildItem('1')];

    render(
      <AssetSelectionContentBody {...defaultProps} items={items as never} />
    );

    fireEvent.click(screen.getByRole('checkbox'));

    expect(mockOnSelectAll).toHaveBeenCalledWith(true);
  });

  it('should show a per-item error message when getErrorStatusAndMessage reports an error', () => {
    mockGetErrorStatusAndMessage.mockReturnValue({
      isError: true,
      errorMessage: 'card failed',
    });
    const items = [buildItem('1')];

    render(
      <AssetSelectionContentBody {...defaultProps} items={items as never} />
    );

    expect(screen.getByText('card failed')).toBeInTheDocument();
  });

  it('should show bottom loader when loading additional pages', () => {
    const items = [buildItem('1')];

    render(
      <AssetSelectionContentBody
        {...defaultProps}
        isLoading
        items={items as never}
        totalCount={5}
      />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should show empty placeholder when not loading and there are no items', () => {
    render(
      <AssetSelectionContentBody
        {...defaultProps}
        emptyPlaceHolderText="no data found"
      />
    );

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
    expect(screen.getByText('no data found')).toBeInTheDocument();
  });

  it('should show loader when loading and there are no items yet', () => {
    render(<AssetSelectionContentBody {...defaultProps} isLoading />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
  });

  it('should render dry run modal when dryRunWarnings is defined', () => {
    render(
      <AssetSelectionContentBody
        {...defaultProps}
        dryRunWarnings={[{ request: { id: '1' } }] as never}
      />
    );

    expect(screen.getByTestId('dry-run-modal')).toBeInTheDocument();
  });

  it('should not render dry run modal when dryRunWarnings is undefined', () => {
    render(<AssetSelectionContentBody {...defaultProps} />);

    expect(screen.queryByTestId('dry-run-modal')).not.toBeInTheDocument();
  });

  it('should wire confirm/cancel of dry run modal to the provided handlers', () => {
    render(
      <AssetSelectionContentBody
        {...defaultProps}
        dryRunWarnings={[{ request: { id: '1' } }] as never}
      />
    );

    fireEvent.click(screen.getByTestId('dry-run-confirm'));
    fireEvent.click(screen.getByTestId('dry-run-cancel'));

    expect(mockConfirmDomainAssetMove).toHaveBeenCalledTimes(1);
    expect(mockCancelDomainAssetMove).toHaveBeenCalledTimes(1);
  });

  it('should call onScroll when the scrollable container is scrolled', () => {
    const items = [buildItem('1')];

    const { container } = render(
      <AssetSelectionContentBody {...defaultProps} items={items as never} />
    );

    const scrollableContainer = screen
      .getByTestId('tabledatacard-1')
      .closest('.asset-list-wrapper')?.parentElement;

    fireEvent.scroll(scrollableContainer ?? container, {
      target: { scrollTop: 100 },
    });

    expect(mockOnScroll).toHaveBeenCalled();
  });
});
