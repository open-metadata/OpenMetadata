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
import { Plus } from '@untitledui/icons';
import { MemoryRouter } from 'react-router-dom';
import NavItem from './NavItem';

describe('NavItem', () => {
  const baseProps = {
    icon: Plus,
    label: 'New Chat',
    onClick: jest.fn(),
  };

  afterEach(() => jest.clearAllMocks());

  it('renders the label text', () => {
    render(<NavItem {...baseProps} />);

    expect(screen.getByText('New Chat')).toBeInTheDocument();
  });

  it('applies the is-active class when active prop is true', () => {
    const { container } = render(<NavItem {...baseProps} active />);

    expect(container.firstChild).toHaveClass('ask-nav-item--active');
  });

  it('does not apply is-active class when active prop is false', () => {
    const { container } = render(<NavItem {...baseProps} />);

    expect(container.firstChild).not.toHaveClass('ask-nav-item--active');
  });

  it('invokes onClick when clicked', () => {
    render(<NavItem {...baseProps} />);
    fireEvent.click(screen.getByRole('button'));

    expect(baseProps.onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a badge when badge prop is provided', () => {
    render(<NavItem {...baseProps} badge="Beta" />);

    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renders an anchor with href when href prop is provided', () => {
    render(
      <MemoryRouter>
        <NavItem {...baseProps} href="/explore" />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: /new chat/i });

    expect(link).toHaveAttribute('href', '/explore');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('still invokes onClick on the anchor when clicked', () => {
    render(
      <MemoryRouter>
        <NavItem {...baseProps} href="/explore" />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('link'));

    expect(baseProps.onClick).toHaveBeenCalledTimes(1);
  });
});
