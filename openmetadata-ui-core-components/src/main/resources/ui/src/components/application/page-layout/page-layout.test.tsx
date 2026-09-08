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
import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { describe, expect, it } from 'vitest';
import { PageLayout } from './page-layout';

describe('PageLayout', () => {
  it('renders content inside a main landmark', () => {
    render(
      <PageLayout>
        <PageLayout.Content>Page body</PageLayout.Content>
      </PageLayout>
    );

    const main = screen.getByRole('main');

    expect(main).toHaveTextContent('Page body');
    expect(main.style.gridArea).toBe('content');
  });

  it('exposes left and right panels as named complementary landmarks', () => {
    render(
      <PageLayout>
        <PageLayout.LeftPanel aria-label="Navigation">Nav</PageLayout.LeftPanel>
        <PageLayout.Content>Body</PageLayout.Content>
        <PageLayout.RightPanel aria-label="Details">
          Aside
        </PageLayout.RightPanel>
      </PageLayout>
    );

    const [left, right] = screen.getAllByRole('complementary');

    expect(left).toHaveAccessibleName('Navigation');
    expect(left.style.gridArea).toBe('left');
    expect(left.style.width).toBe('230px');
    expect(right).toHaveAccessibleName('Details');
    expect(right.style.gridArea).toBe('right');
    expect(right.style.width).toBe('284px');
  });

  it('accepts numeric and string panel widths', () => {
    render(
      <PageLayout>
        <PageLayout.LeftPanel aria-label="A" width={320}>
          A
        </PageLayout.LeftPanel>
        <PageLayout.RightPanel aria-label="B" width="16rem">
          B
        </PageLayout.RightPanel>
      </PageLayout>
    );

    const [left, right] = screen.getAllByRole('complementary');

    expect(left.style.width).toBe('320px');
    expect(right.style.width).toBe('16rem');
  });

  it('applies the default content padding', () => {
    render(
      <PageLayout>
        <PageLayout.Content>Body</PageLayout.Content>
      </PageLayout>
    );

    expect(screen.getByRole('main')).toHaveClass('tw:p-2');
  });

  it('renders the header spanning the full width', () => {
    render(
      <PageLayout>
        <PageLayout.Header>Toolbar</PageLayout.Header>
        <PageLayout.Content>Body</PageLayout.Content>
      </PageLayout>
    );

    const header = screen.getByRole('banner');

    expect(header).toHaveTextContent('Toolbar');
    expect(header.style.gridArea).toBe('header');
  });

  it('wraps centered content and caps its width', () => {
    render(
      <PageLayout>
        <PageLayout.Content center maxWidth={800}>
          <span>Centered</span>
        </PageLayout.Content>
      </PageLayout>
    );

    const wrapper = screen.getByText('Centered').parentElement;

    expect(wrapper).toHaveClass('tw:mx-auto');
    expect(wrapper?.style.maxWidth).toBe('800px');
  });

  it('omits the panel divider when bordered is false', () => {
    render(
      <PageLayout>
        <PageLayout.LeftPanel aria-label="Nav" bordered={false}>
          Nav
        </PageLayout.LeftPanel>
      </PageLayout>
    );

    expect(screen.getByRole('complementary')).not.toHaveClass('tw:border-r');
  });

  it('defaults to content scroll: fixed header, independently scrolling content', () => {
    render(
      <PageLayout>
        <PageLayout.Content>Body</PageLayout.Content>
      </PageLayout>
    );

    const root = screen.getByTestId('page-layout');

    expect(root).toHaveAttribute('data-scroll', 'content');
    expect(root).toHaveClass('tw:overflow-hidden');
    expect(screen.getByRole('main')).toHaveClass(
      'tw:h-full',
      'tw:overflow-y-auto'
    );
  });

  it('lets the whole page scroll as one in page scroll mode', () => {
    render(
      <PageLayout scroll="page">
        <PageLayout.LeftPanel aria-label="Nav">Nav</PageLayout.LeftPanel>
        <PageLayout.Content>Body</PageLayout.Content>
      </PageLayout>
    );

    const root = screen.getByTestId('page-layout');

    expect(root).toHaveAttribute('data-scroll', 'page');
    expect(root).toHaveClass('tw:overflow-y-auto');
    expect(root).not.toHaveClass('tw:overflow-hidden');

    const main = screen.getByRole('main');

    expect(main).not.toHaveClass('tw:h-full');
    expect(main).not.toHaveClass('tw:overflow-y-auto');

    const panel = screen.getByRole('complementary');

    expect(panel).not.toHaveClass('tw:h-full');
    expect(panel).not.toHaveClass('tw:overflow-y-auto');
  });

  it('sets the document title from pageTitle', async () => {
    render(
      <HelmetProvider>
        <PageLayout pageTitle="My Page">
          <PageLayout.Content>Body</PageLayout.Content>
        </PageLayout>
      </HelmetProvider>
    );

    await waitFor(() => expect(document.title).toContain('My Page'));
  });

  it('leaves the document title untouched when pageTitle is omitted', () => {
    document.title = 'Untouched';

    render(
      <HelmetProvider>
        <PageLayout>
          <PageLayout.Content>Body</PageLayout.Content>
        </PageLayout>
      </HelmetProvider>
    );

    expect(document.title).toBe('Untouched');
  });

  it('renders PageLayout.PageHeader as a PageHeader inside the header landmark', () => {
    render(
      <PageLayout>
        <PageLayout.PageHeader
          actions={<button data-testid="hdr-actions">Add</button>}
          title="Explore"
        />
        <PageLayout.Content>Body</PageLayout.Content>
      </PageLayout>
    );

    const header = screen.getByRole('banner');

    expect(header.style.gridArea).toBe('header');
    expect(header).toContainElement(screen.getByTestId('page-header'));
    expect(
      screen.getByRole('heading', { level: 3, name: 'Explore' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('hdr-actions')).toBeInTheDocument();
  });

  it('forwards a ref to the root element', () => {
    let node: HTMLDivElement | null = null;
    render(
      <PageLayout
        ref={(el) => {
          node = el;
        }}>
        <PageLayout.Content>Body</PageLayout.Content>
      </PageLayout>
    );

    expect(node).toBe(screen.getByTestId('page-layout'));
  });
});
