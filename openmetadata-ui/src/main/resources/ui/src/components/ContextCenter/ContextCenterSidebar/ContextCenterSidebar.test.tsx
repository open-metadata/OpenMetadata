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

import { fireEvent, render, screen } from '@testing-library/react';
import { SVGAttributes } from 'react';
import ContextCenterSidebar from './ContextCenterSidebar.component';
import {
  ContextCenterNavSection,
  IconComponent,
} from './ContextCenterSidebar.interface';

const MockIcon: IconComponent = (props: SVGAttributes<SVGElement>) => (
  <svg data-testid="mock-icon" {...props} />
);

const mockSections: ContextCenterNavSection[] = [
  {
    sectionKey: 'main',
    sectionLabel: 'Main Navigation',
    items: [
      { key: 'articles', label: 'Articles', icon: MockIcon, count: 5 },
      { key: 'documents', label: 'Documents', icon: MockIcon },
    ],
  },
  {
    sectionKey: 'settings',
    items: [{ key: 'config', label: 'Config', icon: MockIcon }],
  },
];

describe('ContextCenterSidebar', () => {
  it('renders the sidebar with title', () => {
    render(
      <ContextCenterSidebar sections={mockSections} title="Context Center" />
    );

    expect(screen.getByTestId('context-center-sidebar')).toBeInTheDocument();
    expect(screen.getByText('Context Center')).toBeInTheDocument();
  });

  it('renders section labels when provided', () => {
    render(
      <ContextCenterSidebar sections={mockSections} title="Context Center" />
    );

    expect(screen.getByText('Main Navigation')).toBeInTheDocument();
  });

  it('renders sections with correct data-testid', () => {
    render(
      <ContextCenterSidebar sections={mockSections} title="Context Center" />
    );

    expect(
      screen.getByTestId('context-center-section-main')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('context-center-section-settings')
    ).toBeInTheDocument();
  });

  it('renders all nav item labels', () => {
    render(
      <ContextCenterSidebar sections={mockSections} title="Context Center" />
    );

    expect(screen.getByText('Articles')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Config')).toBeInTheDocument();
  });

  it('renders the count badge when count is provided', () => {
    render(
      <ContextCenterSidebar sections={mockSections} title="Context Center" />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('does not render a count badge when count is not provided', () => {
    render(
      <ContextCenterSidebar sections={mockSections} title="Context Center" />
    );

    const documentsButton = screen.getByTestId('context-center-nav-documents');

    expect(documentsButton.querySelector('span.tw\\:rounded-full')).toBeNull();
  });

  it('applies active class to the active nav item', () => {
    render(
      <ContextCenterSidebar
        activeKey="articles"
        sections={mockSections}
        title="Context Center"
      />
    );

    const activeButton = screen.getByTestId('context-center-nav-articles');

    expect(activeButton.className).toContain(
      'tw:bg-[var(--color-bg-brand-secondary)]'
    );
  });

  it('does not apply active class to inactive nav items', () => {
    render(
      <ContextCenterSidebar
        activeKey="articles"
        sections={mockSections}
        title="Context Center"
      />
    );

    const inactiveButton = screen.getByTestId('context-center-nav-documents');

    expect(inactiveButton.className).not.toContain(
      'tw:bg-[var(--color-bg-brand-secondary)]'
    );
  });

  it('calls onItemClick with the item key when a nav item is clicked', () => {
    const onItemClick = jest.fn();
    render(
      <ContextCenterSidebar
        sections={mockSections}
        title="Context Center"
        onItemClick={onItemClick}
      />
    );

    fireEvent.click(screen.getByTestId('context-center-nav-articles'));

    expect(onItemClick).toHaveBeenCalledWith('articles');
  });

  it('calls item-level onClick when the nav item is clicked', () => {
    const itemOnClick = jest.fn();
    const sections: ContextCenterNavSection[] = [
      {
        sectionKey: 'main',
        items: [
          {
            key: 'custom',
            label: 'Custom',
            icon: MockIcon,
            onClick: itemOnClick,
          },
        ],
      },
    ];
    render(<ContextCenterSidebar sections={sections} title="Context Center" />);

    fireEvent.click(screen.getByTestId('context-center-nav-custom'));

    expect(itemOnClick).toHaveBeenCalled();
  });

  it('renders the menu icon button', () => {
    render(
      <ContextCenterSidebar sections={mockSections} title="Context Center" />
    );

    expect(
      screen.getByTestId('context-center-sidebar-menu')
    ).toBeInTheDocument();
  });
});
