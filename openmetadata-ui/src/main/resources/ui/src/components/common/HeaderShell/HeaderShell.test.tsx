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
import HeaderShell from './HeaderShell.component';

describe('HeaderShell', () => {
  it('renders a string title as a level-3 heading', () => {
    render(<HeaderShell title="My Title" />);

    expect(
      screen.getByRole('heading', { level: 3, name: 'My Title' })
    ).toBeInTheDocument();
  });

  it('renders a React element title as-is without wrapping it in a heading', () => {
    render(
      <HeaderShell title={<span data-testid="custom-title">Custom</span>} />
    );

    expect(screen.getByTestId('custom-title')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('renders every optional slot when provided', () => {
    render(
      <HeaderShell
        actions={<button data-testid="actions">Add</button>}
        badge={<span data-testid="badge">BETA</span>}
        breadcrumb={<nav data-testid="breadcrumb" />}
        footer={<div data-testid="footer" />}
        leading={<span data-testid="leading" />}
        meta={<div data-testid="meta" />}
        subtitle="A subtitle"
        title="Titled"
      />
    );

    expect(screen.getByTestId('leading')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toBeInTheDocument();
    expect(screen.getByTestId('meta')).toBeInTheDocument();
    expect(screen.getByTestId('actions')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByText('A subtitle')).toBeInTheDocument();
  });

  it('renders a React element subtitle as-is', () => {
    render(
      <HeaderShell
        subtitle={<span data-testid="custom-subtitle">Sub</span>}
        title="Titled"
      />
    );

    expect(screen.getByTestId('custom-subtitle')).toBeInTheDocument();
  });

  it('omits the actions container when no actions are passed', () => {
    const { container } = render(<HeaderShell title="No Actions" />);

    expect(container.querySelector('.tw\\:ml-auto')).toBeNull();
  });

  it('renders the actions container when actions are passed', () => {
    const { container } = render(
      <HeaderShell
        actions={<button data-testid="actions">Add</button>}
        title="With Actions"
      />
    );

    expect(container.querySelector('.tw\\:ml-auto')).not.toBeNull();
    expect(screen.getByTestId('actions')).toBeInTheDocument();
  });

  it('applies the Figma gradient and brand border on the gradient variant', () => {
    render(<HeaderShell title="Gradient" variant="gradient" />);

    const { className } = screen.getByTestId('header-shell');

    expect(className).toContain('linear-gradient');
    expect(className).toContain('border-[#EFF8FF]');
  });

  it('does not apply the gradient on the default flat variant', () => {
    render(<HeaderShell title="Flat" />);

    expect(screen.getByTestId('header-shell').className).not.toContain(
      'linear-gradient'
    );
  });

  it('applies a custom className to the card', () => {
    const { container } = render(
      <HeaderShell className="custom-header" title="Classy" />
    );

    expect(container.querySelector('.custom-header')).not.toBeNull();
  });

  it('uses a custom test id when one is provided', () => {
    render(<HeaderShell data-testid="my-shell" title="Custom Id" />);

    expect(screen.getByTestId('my-shell')).toBeInTheDocument();
  });

  it('uses the default test id when none is provided', () => {
    render(<HeaderShell title="Default" />);

    expect(screen.getByTestId('header-shell')).toBeInTheDocument();
  });
});
