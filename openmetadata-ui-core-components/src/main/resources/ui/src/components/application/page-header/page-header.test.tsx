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
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renders a string title as a level-3 heading', () => {
    render(<PageHeader title="My Title" />);

    expect(
      screen.getByRole('heading', { level: 3, name: 'My Title' })
    ).toBeInTheDocument();
  });

  it('renders a React element title as-is without wrapping it in a heading', () => {
    render(
      <PageHeader title={<span data-testid="custom-title">Custom</span>} />
    );

    expect(screen.getByTestId('custom-title')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('renders every optional slot when provided', () => {
    render(
      <PageHeader
        actions={<button data-testid="actions">Add</button>}
        badge={<span data-testid="badge">BETA</span>}
        breadcrumb={<nav data-testid="breadcrumb" />}
        footer={<div data-testid="footer" />}
        icon={<span data-testid="leading" />}
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

  it('renders a default FeaturedIcon tile when icon is a component', () => {
    const Icon = ({ className }: { className?: string }) => (
      <svg className={className} data-testid="header-icon" />
    );
    render(<PageHeader icon={Icon} title="Titled" />);

    expect(screen.getByTestId('header-icon')).toBeInTheDocument();
  });

  it('renders a custom node as-is when icon is a node', () => {
    render(
      <PageHeader icon={<span data-testid="custom-leading" />} title="Titled" />
    );

    expect(screen.getByTestId('custom-leading')).toBeInTheDocument();
  });

  it('renders default Breadcrumbs when breadcrumb is an items array', () => {
    render(
      <PageHeader
        breadcrumb={[
          { id: 'home', label: 'Home', href: '#' },
          { id: 'services', label: 'Services', href: '#' },
          { id: 'snowflake', label: 'Snowflake' },
        ]}
        title="Warehouse overview"
      />
    );

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Services' })).toBeInTheDocument();
    expect(screen.getByText('Snowflake')).toBeInTheDocument();
  });

  it('renders default underline Tabs (with count badges) when footer is a tabs array', () => {
    render(
      <PageHeader
        footer={[
          { id: 'overview', label: 'Overview' },
          { id: 'schema', label: 'Schema', count: 128 },
        ]}
        title="Snowflake"
      />
    );

    expect(screen.getByRole('tab', { name: /Overview/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Schema/ })).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
  });

  it('renders a custom footer node as-is instead of the default tabs', () => {
    render(
      <PageHeader footer={<div data-testid="custom-footer" />} title="Titled" />
    );

    expect(screen.getByTestId('custom-footer')).toBeInTheDocument();
  });

  it('renders a custom breadcrumb node as-is instead of the default', () => {
    render(
      <PageHeader
        breadcrumb={<nav data-testid="custom-breadcrumb" />}
        title="Titled"
      />
    );

    expect(screen.getByTestId('custom-breadcrumb')).toBeInTheDocument();
  });

  it('renders a React element subtitle as-is', () => {
    render(
      <PageHeader
        subtitle={<span data-testid="custom-subtitle">Sub</span>}
        title="Titled"
      />
    );

    expect(screen.getByTestId('custom-subtitle')).toBeInTheDocument();
  });

  it('omits the actions container when no actions are passed', () => {
    const { container } = render(<PageHeader title="No Actions" />);

    expect(container.querySelector('.tw\\:ml-auto')).toBeNull();
  });

  it('renders the actions container when actions are passed', () => {
    const { container } = render(
      <PageHeader
        actions={<button data-testid="actions">Add</button>}
        title="With Actions"
      />
    );

    expect(container.querySelector('.tw\\:ml-auto')).toHaveClass('tw:shrink-0');
    expect(screen.getByTestId('actions')).toBeInTheDocument();
  });

  it('truncates a long string title without shrinking adjacent content', () => {
    const actionLabel = 'Action';
    const badgeLabel = 'Badge';
    const title = 'A'.repeat(200);
    render(
      <PageHeader
        actions={<button>{actionLabel}</button>}
        badge={<span data-testid="badge">{badgeLabel}</span>}
        title={title}
      />
    );

    const heading = screen.getByRole('heading', { level: 3, name: title });
    const titleRow = heading.parentElement?.parentElement;
    const titleContent = titleRow?.parentElement;

    expect(heading).toHaveClass('tw:min-w-0', 'tw:truncate');
    expect(heading.parentElement).toHaveClass('tw:truncate');
    expect(titleRow).toHaveClass('tw:min-w-0');
    expect(titleContent).toHaveClass('tw:min-w-0', 'tw:flex-1');
    expect(screen.getByTestId('badge').parentElement).toHaveClass(
      'tw:shrink-0'
    );
    expect(
      screen.getByRole('button', { name: actionLabel }).parentElement
    ).toHaveClass('tw:shrink-0');
  });

  it('renders a zero-valued badge', () => {
    render(<PageHeader badge={0} title="Badge count" />);

    expect(screen.getByText('0')).toHaveClass('tw:shrink-0');
  });

  it('renders a search input in the right cluster when search is provided', () => {
    render(<PageHeader search={{ placeholder: 'Search…' }} title="Titled" />);

    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
  });

  it('forwards extra HTML attributes (className, id) to the root', () => {
    render(<PageHeader className="custom-root" id="hdr" title="Titled" />);

    const root = screen.getByTestId('page-header');

    expect(root).toHaveClass('custom-root');
    expect(root).toHaveAttribute('id', 'hdr');
  });

  it('applies the Figma gradient and brand border on the gradient variant', () => {
    render(<PageHeader title="Gradient" variant="gradient" />);

    const { className } = screen.getByTestId('page-header');

    expect(className).toContain('linear-gradient');
    expect(className).toContain('border-brand-50');
  });

  it('does not apply the gradient on the default flat variant', () => {
    render(<PageHeader title="Flat" />);

    expect(screen.getByTestId('page-header').className).not.toContain(
      'linear-gradient'
    );
  });

  it('renders the card without a shadow to match the Figma design', () => {
    render(<PageHeader title="No Shadow" variant="gradient" />);

    expect(screen.getByTestId('page-header').className).not.toContain('shadow');
  });

  it('applies a custom className to the card', () => {
    const { container } = render(
      <PageHeader className="custom-header" title="Classy" />
    );

    expect(container.querySelector('.custom-header')).not.toBeNull();
  });

  it('uses a custom test id when one is provided', () => {
    render(<PageHeader data-testid="my-header" title="Custom Id" />);

    expect(screen.getByTestId('my-header')).toBeInTheDocument();
  });

  it('uses the default test id when none is provided', () => {
    render(<PageHeader title="Default" />);

    expect(screen.getByTestId('page-header')).toBeInTheDocument();
  });
});
