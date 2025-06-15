/*
 *  Copyright 2024 Collate.
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

import '@testing-library/jest-dom/extend-expect';
import { act, fireEvent, render, screen } from '@testing-library/react';
import NextPreviousWithOffset from './NextPreviousWithOffset';

const mockPagingHandler = jest.fn();
const defaultProps = {
  paging: { total: 100 },
  pagingHandler: mockPagingHandler,
  pageSize: 10,
  currentPage: 1,
  isLoading: false,
};

describe('NextPreviousWithOffset', () => {
  it('should render without crashing', () => {
    render(<NextPreviousWithOffset {...defaultProps} />);

    expect(screen.getByTestId('pagination')).toBeInTheDocument();
  });

  it('should display the correct current page and total pages', () => {
    render(<NextPreviousWithOffset {...defaultProps} />);

    expect(screen.getByTestId('page-indicator')).toHaveTextContent(
      '1/10 label.page'
    );
  });

  it('should call pagingHandler with correct arguments when next button is clicked', () => {
    render(<NextPreviousWithOffset {...defaultProps} />);
    fireEvent.click(screen.getByTestId('next'));

    expect(mockPagingHandler).toHaveBeenCalledWith({ offset: 10, page: 2 });
  });

  it('should call pagingHandler with correct arguments when previous button is clicked', () => {
    const props = { ...defaultProps, currentPage: 2 };
    render(<NextPreviousWithOffset {...props} />);
    fireEvent.click(screen.getByTestId('previous'));

    expect(mockPagingHandler).toHaveBeenCalledWith({ offset: 0, page: 1 });
  });

  it('should disable previous button on the first page', () => {
    render(<NextPreviousWithOffset {...defaultProps} />);

    expect(screen.getByTestId('previous')).toBeDisabled();
  });

  it('should disable next button on the last page', () => {
    const props = { ...defaultProps, currentPage: 10 };
    render(<NextPreviousWithOffset {...props} />);

    expect(screen.getByTestId('next')).toBeDisabled();
  });

  it('should disable both buttons when loading', () => {
    const props = { ...defaultProps, isLoading: true };
    render(<NextPreviousWithOffset {...props} />);

    expect(screen.getByTestId('previous')).toBeDisabled();
    expect(screen.getByTestId('next')).toBeDisabled();
  });

  it('should render page size dropdown when onShowSizeChange is provided', () => {
    const props = { ...defaultProps, onShowSizeChange: jest.fn() };
    render(<NextPreviousWithOffset {...props} />);

    expect(screen.getByText('10 / label.page')).toBeInTheDocument();
  });

  it.skip('should call onShowSizeChange with correct size when page size is changed', async () => {
    const mockOnShowSizeChange = jest.fn();
    const props = {
      ...defaultProps,
      pageSize: 15,
      onShowSizeChange: mockOnShowSizeChange,
    };
    render(<NextPreviousWithOffset {...props} />);

    const pageSizeButton = screen.getByText('15 / label.page');

    await act(async () => {
      fireEvent.click(pageSizeButton);
    });

    const pageOption25 = screen.getByText('25 / label.page', {
      selector: '.ant-dropdown-menu-item',
    });

    await act(async () => {
      fireEvent.click(pageOption25);
    });

    expect(mockOnShowSizeChange).toHaveBeenCalledWith(25);

    const pageSizeButton2 = screen.getByText('25 / label.page');

    await act(async () => {
      fireEvent.click(pageSizeButton2);
    });

    const pageOption50 = await screen.findByText('50 / label.page');

    await act(async () => {
      fireEvent.click(pageOption50);
    });

    expect(mockOnShowSizeChange).toHaveBeenCalledWith(50);
  });
});
