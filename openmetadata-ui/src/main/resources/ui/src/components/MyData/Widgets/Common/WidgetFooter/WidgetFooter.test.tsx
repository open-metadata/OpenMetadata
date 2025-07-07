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

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WidgetFooter from './WidgetFooter';

const mockProps = {
  showMoreButton: true,
  moreButtonText: 'View More',
  onMoreClick: jest.fn(),
  className: 'custom-footer-class',
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
    expect(screen.getByTestId('arrow-right-icon')).toBeInTheDocument();
  });

  it('uses default more button text when not provided', () => {
    renderWidgetFooter({ moreButtonText: undefined });

    expect(screen.getByText('label.view-more')).toBeInTheDocument();
  });

  it('returns null when showMoreButton is false', () => {
    const { container } = renderWidgetFooter({ showMoreButton: false });

    expect(container.firstChild).toBeNull();
  });

  it('applies custom className', () => {
    renderWidgetFooter();

    const footer = screen.getByTestId('widget-footer');

    expect(footer).toHaveClass('custom-footer-class');
  });

  it('renders without onMoreClick when not provided', () => {
    renderWidgetFooter({ onMoreClick: undefined });

    expect(screen.queryByText('View More')).not.toBeInTheDocument();
  });

  it('renders with correct href attribute', () => {
    renderWidgetFooter();

    const link = screen.getByText('View More').closest('a');

    expect(link).toHaveAttribute('href', 'users/undefined/task');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
