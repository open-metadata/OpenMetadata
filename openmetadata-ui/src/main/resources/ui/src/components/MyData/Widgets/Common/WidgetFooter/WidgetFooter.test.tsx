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
import { MemoryRouter } from 'react-router-dom';
import WidgetFooter from './WidgetFooter';

const mockProps = {
  showMoreButton: true,
  moreButtonText: 'View More',
  onMoreClick: jest.fn(),
  children: <div data-testid="footer-children">Footer Content</div>,
  className: 'custom-footer-class',
  dataTestId: 'test-widget-footer',
};

const renderWidgetFooter = (props = {}) => {
  return render(
    <MemoryRouter>
      <WidgetFooter {...mockProps} {...props} />
    </MemoryRouter>
  );
};

describe('WidgetFooter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with more button when showMoreButton is true', () => {
    renderWidgetFooter();

    expect(screen.getByText('View More')).toBeInTheDocument();
    expect(screen.getByTestId('footer-children')).toBeInTheDocument();
  });

  it('calls onMoreClick when more button is clicked', () => {
    renderWidgetFooter();

    const moreButton = screen.getByText('View More');
    fireEvent.click(moreButton);

    expect(mockProps.onMoreClick).toHaveBeenCalled();
  });

  it('uses default more button text when not provided', () => {
    renderWidgetFooter({ moreButtonText: undefined });

    expect(screen.getByText('label.more')).toBeInTheDocument();
  });

  it('renders only children when showMoreButton is false', () => {
    renderWidgetFooter({ showMoreButton: false });

    expect(screen.getByTestId('footer-children')).toBeInTheDocument();
    expect(screen.queryByText('View More')).not.toBeInTheDocument();
  });

  it('renders only more button when no children provided', () => {
    renderWidgetFooter({ children: undefined });

    expect(screen.getByText('View More')).toBeInTheDocument();
    expect(screen.queryByTestId('footer-children')).not.toBeInTheDocument();
  });

  it('returns null when neither showMoreButton nor children are provided', () => {
    const { container } = renderWidgetFooter({
      showMoreButton: false,
      children: undefined,
    });

    expect(container.firstChild).toBeNull();
  });

  it('applies custom className', () => {
    renderWidgetFooter();

    const footer = screen.getByTestId('test-widget-footer');

    expect(footer).toHaveClass('custom-footer-class');
  });

  it('renders without onMoreClick when not provided', () => {
    renderWidgetFooter({ onMoreClick: undefined });

    expect(screen.queryByText('View More')).not.toBeInTheDocument();
  });

  it('renders with custom data test id', () => {
    renderWidgetFooter({ dataTestId: 'custom-footer' });

    expect(screen.getByTestId('custom-footer')).toBeInTheDocument();
  });

  it('renders multiple children correctly', () => {
    renderWidgetFooter({
      children: (
        <>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </>
      ),
    });

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
  });

  it('handles complex children with buttons', () => {
    renderWidgetFooter({
      children: (
        <button data-testid="custom-button" onClick={jest.fn()}>
          Custom Button
        </button>
      ),
    });

    expect(screen.getByTestId('custom-button')).toBeInTheDocument();
  });
});
