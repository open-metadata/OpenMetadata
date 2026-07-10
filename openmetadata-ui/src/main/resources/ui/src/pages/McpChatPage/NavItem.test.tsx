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

import { fireEvent, render, screen } from '@testing-library/react';
import { SVGProps } from 'react';
import NavItem from './NavItem';

const MockIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg data-testid="mock-icon" {...props} />
);

describe('NavItem', () => {
  it('renders the label', () => {
    render(<NavItem icon={MockIcon} label="New Chat" onClick={jest.fn()} />);

    expect(screen.getByText('New Chat')).toBeInTheDocument();
  });

  it('renders the icon', () => {
    render(<NavItem icon={MockIcon} label="New Chat" onClick={jest.fn()} />);

    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<NavItem icon={MockIcon} label="New Chat" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('sets data-testid from dataTestId prop', () => {
    render(
      <NavItem
        dataTestId="new-chat-button"
        icon={MockIcon}
        label="New Chat"
        onClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('new-chat-button')).toBeInTheDocument();
  });

  it('renders badge when provided', () => {
    render(
      <NavItem
        badge="NEW"
        icon={MockIcon}
        label="New Chat"
        onClick={jest.fn()}
      />
    );

    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('does not render badge when not provided', () => {
    render(<NavItem icon={MockIcon} label="New Chat" onClick={jest.fn()} />);

    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
  });

  it('applies active styling class when active is true', () => {
    render(
      <NavItem active icon={MockIcon} label="Active Item" onClick={jest.fn()} />
    );

    const button = screen.getByRole('button');

    expect(button.className).toContain('tw:bg-blue-50');
  });

  it('does not apply active class when active is false', () => {
    render(
      <NavItem
        active={false}
        icon={MockIcon}
        label="Inactive Item"
        onClick={jest.fn()}
      />
    );

    const button = screen.getByRole('button');

    expect(button.className).not.toContain('tw:bg-blue-50');
  });

  it('label has font-medium when active', () => {
    render(
      <NavItem active icon={MockIcon} label="Active" onClick={jest.fn()} />
    );

    const label = screen.getByText('Active');

    expect(label.className).toContain('tw:font-medium');
  });

  it('label has font-normal when not active', () => {
    render(
      <NavItem
        active={false}
        icon={MockIcon}
        label="Inactive"
        onClick={jest.fn()}
      />
    );

    const label = screen.getByText('Inactive');

    expect(label.className).toContain('tw:font-normal');
  });
});
