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
import { MemoryRouter } from 'react-router-dom';
import { useSearchStore } from '../../../hooks/useSearchStore';
import {
  getNLPEnabledStatus,
  nlqSearch,
  searchQuery,
} from '../../../rest/searchAPI';
import MarketplaceSearchBar from './MarketplaceSearchBar.component';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../rest/searchAPI', () => ({
  getNLPEnabledStatus: jest.fn().mockResolvedValue(true),
  nlqSearch: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
  searchQuery: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
}));

jest.mock('../../../hooks/useMarketplaceStore', () => ({
  useMarketplaceStore: jest.fn().mockReturnValue({
    dataProductBasePath: '/dataProduct',
  }),
}));

jest.mock('../../../hooks/useMarketplaceRecentSearches', () => ({
  useMarketplaceRecentSearches: jest.fn().mockReturnValue({
    addSearch: jest.fn(),
  }),
}));

jest.mock('../../../utils/DataProductUtils', () => ({
  getDataProductIconByUrl: jest.fn().mockReturnValue(<span>dp-icon</span>),
}));

jest.mock('../../../utils/DomainUtils', () => ({
  getDomainIcon: jest.fn().mockReturnValue(<span>domain-icon</span>),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getDomainDetailsPath: jest.fn((fqn) => `/domain/${fqn}`),
}));

jest.mock('../../../utils/StringUtils', () => ({
  getEncodedFqn: jest.fn((fqn) => fqn),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const Input = ({
    value,
    onChange,
    onKeyDown,
    placeholder,
    isDisabled,
    ...rest
  }: {
    value?: string;
    onChange?: (val: string) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    isDisabled?: boolean;
  } & Record<string, unknown>) => (
    <input
      data-testid="marketplace-search-input"
      disabled={isDisabled}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={onKeyDown}
      {...rest}
    />
  );

  const SelectPopover = ({
    children,
    isOpen,
  }: {
    children: React.ReactNode;
    isOpen?: boolean;
  }) => (isOpen ? <div data-testid="search-popover">{children}</div> : null);

  const Typography = ({
    children,
    ...rest
  }: {
    children?: React.ReactNode;
  } & Record<string, unknown>) => <span {...rest}>{children}</span>;

  return { Input, SelectPopover, Typography };
});

jest.mock('@untitledui/icons', () => ({
  SearchLg: () => <span data-testid="search-icon">search</span>,
}));

const mockDataProducts = [
  {
    id: 'dp-1',
    name: 'product-one',
    displayName: 'Product One',
    fullyQualifiedName: 'domain.product-one',
    style: { iconURL: '' },
  },
];

const mockDomains = [
  {
    id: 'domain-1',
    name: 'marketing',
    displayName: 'Marketing',
    fullyQualifiedName: 'marketing',
    style: { iconURL: '' },
  },
];

const renderComponent = (props = {}) =>
  render(<MarketplaceSearchBar {...props} />, { wrapper: MemoryRouter });

describe('MarketplaceSearchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSearchStore.setState({
      isNLPEnabled: true,
      isNLPActive: false,
      isNLPInitialized: true,
    });
    (getNLPEnabledStatus as jest.Mock).mockResolvedValue(true);
    (searchQuery as jest.Mock).mockResolvedValue({ hits: { hits: [] } });
    (nlqSearch as jest.Mock).mockResolvedValue({ hits: { hits: [] } });
  });

  it('renders the search input', () => {
    renderComponent();

    expect(screen.getByTestId('marketplace-search-bar')).toBeInTheDocument();
    expect(screen.getByTestId('marketplace-search-input')).toBeInTheDocument();
  });

  it('shows NLQ toggle button when NLP is enabled', () => {
    renderComponent();

    const toggleBtn = screen.getByTestId('marketplace-nlq-toggle');

    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).not.toHaveClass('active');
  });

  it('shows search icon fallback when NLP is disabled', () => {
    useSearchStore.setState({ isNLPEnabled: false, isNLPActive: false });

    renderComponent();

    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    expect(
      screen.queryByTestId('marketplace-nlq-toggle')
    ).not.toBeInTheDocument();
  });

  it('bootstraps isNLPEnabled from API when store is cold (direct marketplace navigation)', async () => {
    useSearchStore.setState({
      isNLPEnabled: false,
      isNLPActive: false,
      isNLPInitialized: false,
    });
    (getNLPEnabledStatus as jest.Mock).mockResolvedValue(true);

    renderComponent();

    await waitFor(() => {
      expect(getNLPEnabledStatus).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('marketplace-nlq-toggle')).toBeInTheDocument();
    });
  });

  it('skips the API call when store is already initialized', () => {
    useSearchStore.setState({
      isNLPEnabled: false,
      isNLPActive: false,
      isNLPInitialized: true,
    });

    renderComponent();

    expect(getNLPEnabledStatus).not.toHaveBeenCalled();
  });

  it('toggles NLQ active state when the toggle button is clicked', async () => {
    renderComponent();

    const toggleBtn = screen.getByTestId('marketplace-nlq-toggle');

    expect(toggleBtn).not.toHaveClass('active');
    expect(toggleBtn).toHaveAttribute(
      'title',
      'label.use-natural-language-search'
    );

    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    expect(toggleBtn).toHaveClass('active');
    expect(toggleBtn).toHaveAttribute(
      'title',
      'message.natural-language-search-active'
    );

    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    expect(toggleBtn).not.toHaveClass('active');
  });

  it('calls searchQuery for data products and domains on input change', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: { hits: mockDataProducts.map((dp) => ({ _source: dp })) },
    });

    renderComponent();

    const input = screen.getByTestId('marketplace-search-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'product' } });
    });

    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'product' })
      );
    });
  });

  it('calls nlqSearch when NLQ is active and NLP is enabled', async () => {
    useSearchStore.setState({ isNLPEnabled: true, isNLPActive: true });
    (nlqSearch as jest.Mock).mockResolvedValue({ hits: { hits: [] } });

    renderComponent();

    const input = screen.getByTestId('marketplace-search-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'revenue data' } });
    });

    await waitFor(() => {
      expect(nlqSearch).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'revenue data' })
      );
    });
  });

  it('does not open popover when input is empty', async () => {
    renderComponent();

    const input = screen.getByTestId('marketplace-search-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: '' } });
    });

    expect(screen.queryByTestId('search-popover')).not.toBeInTheDocument();
  });

  it('shows data product results in the popover', async () => {
    (searchQuery as jest.Mock)
      .mockResolvedValueOnce({
        hits: { hits: mockDataProducts.map((dp) => ({ _source: dp })) },
      })
      .mockResolvedValueOnce({ hits: { hits: [] } });

    renderComponent();

    const input = screen.getByTestId('marketplace-search-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'product' } });
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-dp-dp-1')).toBeInTheDocument();
      expect(screen.getByText('Product One')).toBeInTheDocument();
    });
  });

  it('shows domain results in the popover', async () => {
    (searchQuery as jest.Mock)
      .mockResolvedValueOnce({ hits: { hits: [] } })
      .mockResolvedValueOnce({
        hits: { hits: mockDomains.map((d) => ({ _source: d })) },
      });

    renderComponent();

    const input = screen.getByTestId('marketplace-search-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'marketing' } });
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('search-result-domain-domain-1')
      ).toBeInTheDocument();
      expect(screen.getByText('Marketing')).toBeInTheDocument();
    });
  });

  it('shows no-data message when search returns empty results', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({ hits: { hits: [] } });

    renderComponent();

    const input = screen.getByTestId('marketplace-search-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'xyz-no-match' } });
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-popover')).toBeInTheDocument();
      expect(screen.getByText(/no-data-found/i)).toBeInTheDocument();
    });
  });

  it('navigates to data product page when a result is clicked', async () => {
    (searchQuery as jest.Mock)
      .mockResolvedValueOnce({
        hits: { hits: mockDataProducts.map((dp) => ({ _source: dp })) },
      })
      .mockResolvedValueOnce({ hits: { hits: [] } });

    renderComponent();

    const input = screen.getByTestId('marketplace-search-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'product' } });
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-dp-dp-1')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('search-result-dp-dp-1'));
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      '/dataProduct/domain.product-one',
      { state: { fromMarketplace: true } }
    );
  });

  it('navigates to domain page when a domain result is clicked', async () => {
    (searchQuery as jest.Mock)
      .mockResolvedValueOnce({ hits: { hits: [] } })
      .mockResolvedValueOnce({
        hits: { hits: mockDomains.map((d) => ({ _source: d })) },
      });

    renderComponent();

    const input = screen.getByTestId('marketplace-search-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'marketing' } });
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('search-result-domain-domain-1')
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('search-result-domain-domain-1'));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/domain/marketing', {
      state: { fromMarketplace: true },
    });
  });

  it('clears results and closes popover when input is cleared', async () => {
    (searchQuery as jest.Mock)
      .mockResolvedValueOnce({
        hits: { hits: mockDataProducts.map((dp) => ({ _source: dp })) },
      })
      .mockResolvedValueOnce({ hits: { hits: [] } });

    renderComponent();

    const input = screen.getByTestId('marketplace-search-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'product' } });
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-popover')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(input, { target: { value: '' } });
    });

    expect(screen.queryByTestId('search-popover')).not.toBeInTheDocument();
  });

  it('does not search when component is in edit view', () => {
    renderComponent({ isEditView: true });

    const input = screen.getByTestId('marketplace-search-input');

    expect(input).toBeDisabled();
  });

  it('triggers search on Enter key press', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({ hits: { hits: [] } });

    renderComponent();

    const input = screen.getByTestId('marketplace-search-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test query' } });
    });

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalled();
    });
  });

  it('handles search API error gracefully', async () => {
    (searchQuery as jest.Mock).mockRejectedValue(new Error('API error'));

    renderComponent();

    const input = screen.getByTestId('marketplace-search-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'error case' } });
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-popover')).toBeInTheDocument();
      expect(screen.getByText(/no-data-found/i)).toBeInTheDocument();
    });
  });
});
