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
        <PageLayout.RightPanel aria-label="Details">Aside</PageLayout.RightPanel>
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

  it('defaults to the 16px gutter and switches to 8px for the compact variant', () => {
    const { rerender } = render(
      <PageLayout>
        <PageLayout.Content>Body</PageLayout.Content>
      </PageLayout>
    );

    expect(screen.getByRole('main')).toHaveClass('tw:px-4');
    expect(screen.getByTestId('page-layout')).toHaveAttribute(
      'data-variant',
      'default'
    );

    rerender(
      <PageLayout variant="compact">
        <PageLayout.Content>Body</PageLayout.Content>
      </PageLayout>
    );

    expect(screen.getByRole('main')).toHaveClass('tw:p-2');
    expect(screen.getByTestId('page-layout')).toHaveAttribute(
      'data-variant',
      'compact'
    );
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

    expect(screen.getByRole('complementary')).not.toHaveClass(
      'tw:border-r'
    );
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
