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
import { fireEvent, render, screen } from '@testing-library/react';
import { TagRenderer } from './TagRenderer';

describe('TagRenderer', () => {
  const mockOnClose = jest.fn();
  const defaultProps = {
    label: 'Test Label',
    value: 'test-value',
    closable: true,
    onClose: mockOnClose,
    disabled: false,
    onMouseDown: jest.fn(),
    isMaxTag: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the label', () => {
    render(<TagRenderer {...defaultProps} />);

    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('should truncate long labels and add ellipsis', () => {
    const longLabel = 'test persona test test persona 5';
    render(<TagRenderer {...defaultProps} label={longLabel} />);

    expect(screen.getByText('test persona...')).toBeInTheDocument();
    expect(screen.getByTitle(longLabel)).toBeInTheDocument();
  });

  it('should render close button when closable is true', () => {
    render(<TagRenderer {...defaultProps} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(<TagRenderer {...defaultProps} />);

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
