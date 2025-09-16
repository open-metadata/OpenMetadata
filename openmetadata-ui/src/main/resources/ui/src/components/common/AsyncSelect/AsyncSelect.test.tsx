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
import { DefaultOptionType } from 'antd/lib/select';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AsyncSelect, PagingResponse } from './AsyncSelect';

// Mock dependencies
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../Loader/Loader', () => {
  return function MockLoader({ size }: { size?: string }) {
    return <div data-testid={`loader-${size || 'default'}`}>Loading...</div>;
  };
});

// Mock debounce to make tests synchronous
jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  debounce: (fn: any) => fn,
}));

const mockOptions: DefaultOptionType[] = [
  { label: 'Option 1', value: 'option1' },
  { label: 'Option 2', value: 'option2' },
  { label: 'Option 3', value: 'option3' },
];

const mockPaginatedResponse: PagingResponse<DefaultOptionType[]> = {
  data: mockOptions,
  paging: {
    total: 10,
    after: 'cursor1',
    before: 'cursor2',
  },
};

describe('AsyncSelect Component', () => {
  const mockApi = jest.fn();
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (showErrorToast as jest.Mock).mockClear();
  });

  describe('Basic Functionality', () => {
    it('should render AsyncSelect component', () => {
      mockApi.mockResolvedValue(mockOptions);

      render(
        <AsyncSelect
          api={mockApi}
          data-testid="async-select"
          placeholder="Select option"
        />
      );

      expect(screen.getByTestId('async-select')).toBeInTheDocument();
    });

    it('should call API on mount with empty search', async () => {
      mockApi.mockResolvedValue(mockOptions);

      render(<AsyncSelect api={mockApi} data-testid="async-select" />);

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith('', undefined);
      });
    });

    it('should display loading state initially', async () => {
      mockApi.mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(mockOptions), 100))
      );

      render(<AsyncSelect api={mockApi} data-testid="async-select" />);

      expect(screen.getByTestId('loader-small')).toBeInTheDocument();
    });

    it('should populate options after API call', async () => {
      mockApi.mockResolvedValue(mockOptions);

      render(<AsyncSelect api={mockApi} data-testid="async-select" />);

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
        expect(screen.getByText('Option 2')).toBeInTheDocument();
        expect(screen.getByText('Option 3')).toBeInTheDocument();
      });
    });

    it('should call API with search text when typing', async () => {
      mockApi.mockResolvedValue(mockOptions);

      render(<AsyncSelect api={mockApi} data-testid="async-select" />);

      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: 'test search' } });

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith('test search', undefined);
      });
    });

    it('should handle option selection', async () => {
      mockApi.mockResolvedValue(mockOptions);

      render(
        <AsyncSelect
          api={mockApi}
          data-testid="async-select"
          onSelect={mockOnSelect}
        />
      );

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Option 1'));

      expect(mockOnSelect).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockApi.mockRejectedValue(error);

      render(<AsyncSelect api={mockApi} data-testid="async-select" />);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('Infinite Scroll Functionality', () => {
    it('should enable infinite scroll when enableInfiniteScroll is true', async () => {
      mockApi.mockResolvedValue(mockPaginatedResponse);

      render(
        <AsyncSelect
          enableInfiniteScroll
          api={mockApi}
          data-testid="async-select"
        />
      );

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith('', 1);
      });
    });

    it('should handle paginated response correctly', async () => {
      mockApi.mockResolvedValue(mockPaginatedResponse);

      render(
        <AsyncSelect
          enableInfiniteScroll
          api={mockApi}
          data-testid="async-select"
        />
      );

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
        expect(screen.getByText('Option 2')).toBeInTheDocument();
        expect(screen.getByText('Option 3')).toBeInTheDocument();
      });
    });

    it('should not load more when all options are loaded', async () => {
      const limitedResponse: PagingResponse<DefaultOptionType[]> = {
        data: mockOptions,
        paging: { total: 3 }, // Same as data length
      };

      mockApi.mockResolvedValue(limitedResponse);

      render(
        <AsyncSelect
          enableInfiniteScroll
          api={mockApi}
          data-testid="async-select"
        />
      );

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
      });

      // Simulate scroll to bottom
      const dropdown = screen.getByRole('listbox');
      Object.defineProperty(dropdown, 'scrollTop', {
        value: 100,
        writable: true,
      });
      Object.defineProperty(dropdown, 'offsetHeight', {
        value: 100,
        writable: true,
      });
      Object.defineProperty(dropdown, 'scrollHeight', {
        value: 200,
        writable: true,
      });

      fireEvent.scroll(dropdown);

      // Should not call API again since all options are loaded
      expect(mockApi).toHaveBeenCalledTimes(1);
    });

    it('should reset page when search text changes', async () => {
      mockApi.mockResolvedValue(mockPaginatedResponse);

      render(
        <AsyncSelect
          enableInfiniteScroll
          api={mockApi}
          data-testid="async-select"
        />
      );

      const input = screen.getByRole('combobox');

      // Initial load
      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith('', 1);
      });

      // Change search text
      fireEvent.change(input, { target: { value: 'new search' } });

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith('new search', 1);
      });
    });
  });

  describe('Configuration Options', () => {
    it('should use custom debounce timeout', async () => {
      mockApi.mockResolvedValue(mockOptions);

      render(
        <AsyncSelect
          api={mockApi}
          data-testid="async-select"
          debounceTimeout={1000}
        />
      );

      // Since we mocked debounce to be synchronous, this just ensures the prop is passed
      expect(screen.getByTestId('async-select')).toBeInTheDocument();
    });

    it('should work without infinite scroll by default', async () => {
      mockApi.mockResolvedValue(mockOptions);

      render(<AsyncSelect api={mockApi} data-testid="async-select" />);

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith('', undefined);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty API response', async () => {
      mockApi.mockResolvedValue([]);

      render(<AsyncSelect api={mockApi} data-testid="async-select" />);

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalled();
      });

      // Should not crash and should show no options
      expect(screen.queryByText('Option 1')).not.toBeInTheDocument();
    });

    it('should handle scroll events when infinite scroll is disabled', async () => {
      mockApi.mockResolvedValue(mockOptions);

      render(<AsyncSelect api={mockApi} data-testid="async-select" />);

      fireEvent.mouseDown(screen.getByRole('combobox'));

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
      });

      // Simulate scroll - should not trigger additional API calls
      const dropdown = screen.getByRole('listbox');
      fireEvent.scroll(dropdown);

      expect(mockApi).toHaveBeenCalledTimes(1);
    });
  });
});
