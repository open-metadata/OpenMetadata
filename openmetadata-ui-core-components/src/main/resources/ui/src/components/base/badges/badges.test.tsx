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

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge, BadgeWithButton, BadgeWithDot } from './badges';

describe('Badge theme roles', () => {
  it('uses shared surface and border roles for a modern badge', () => {
    render(
      <Badge data-testid="badge" type="modern">
        Active
      </Badge>
    );

    expect(screen.getByTestId('badge')).toHaveClass(
      'tw:bg-surface',
      'tw:outline-subtle'
    );
  });

  it('uses theme-aware roles for a modern neutral badge', () => {
    render(
      <BadgeWithDot type="modern">
        <span>Active</span>
      </BadgeWithDot>
    );

    const badge = screen.getByText('Active').parentElement;

    expect(badge).toHaveClass('tw:bg-surface', 'tw:outline-subtle');
    expect(badge?.querySelector('svg')).toHaveClass('tw:text-utility-gray-500');
  });
});

describe('Badge tooltip', () => {
  it('does not render a tooltip trigger when no tooltip is passed', () => {
    render(<Badge data-testid="badge">Active</Badge>);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a tooltip trigger when tooltip is passed', () => {
    render(
      <Badge data-testid="badge" tooltip="Contains PII data">
        Active
      </Badge>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

describe('Badge href', () => {
  it('renders a plain span when no href is passed', () => {
    const { container } = render(<Badge>Active</Badge>);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveProperty('tagName', 'SPAN');
  });

  it('renders as a link covering the whole badge when href is passed', () => {
    render(<Badge href="/classification/pii">Active</Badge>);

    const badge = screen.getByRole('link');

    expect(badge).toHaveAttribute('href', '/classification/pii');
    expect(badge).toContainElement(screen.getByText('Active'));
  });

  it('does not apply visible link styling (underline) when href is passed', () => {
    render(<Badge href="/classification/pii">Active</Badge>);

    expect(screen.getByRole('link')).toHaveClass('tw:no-underline');
  });
});

describe('BadgeWithButton tooltip', () => {
  it('renders both the tooltip trigger and the delete button without nesting a button in a button', () => {
    render(
      <BadgeWithButton buttonTestId="delete-button" tooltip="Delete this tag">
        Active
      </BadgeWithButton>
    );

    const buttons = screen.getAllByRole('button');

    expect(buttons).toHaveLength(2);
    expect(screen.getByTestId('delete-button')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('does not render a tooltip trigger when no tooltip is passed', () => {
    render(
      <BadgeWithButton buttonTestId="delete-button">Active</BadgeWithButton>
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
