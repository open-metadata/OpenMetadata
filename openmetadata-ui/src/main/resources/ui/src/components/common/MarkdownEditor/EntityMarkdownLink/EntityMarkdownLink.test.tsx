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
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import EntityMarkdownLink from './EntityMarkdownLink';

// Mock EntityPopOverCard to prevent complex dependencies in tests
jest.mock('../../PopOverCard/EntityPopOverCard', () => ({
  __esModule: true,
  default: ({
    children,
    entityFQN,
    entityType,
  }: {
    children: React.ReactNode;
    entityFQN: string;
    entityType: string;
  }) => (
    <div
      data-fqn={entityFQN}
      data-testid="entity-popover-card"
      data-type={entityType}>
      {children}
    </div>
  ),
}));

// Mock EntityUtilClassBase to control entity link resolution
jest.mock('../../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: (type: EntityType, fqn: string) => `/entity/${type}/${fqn}`,
  },
}));

describe('EntityMarkdownLink', () => {
  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it('should render regular link for non-entity URLs', () => {
    renderWithRouter(
      <EntityMarkdownLink href="https://example.com">
        External Link
      </EntityMarkdownLink>
    );

    const link = screen.getByText('External Link');

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('should render entity link for table entity format', () => {
    renderWithRouter(
      <EntityMarkdownLink href="#table/red.dev.dbt_jaffle.customers">
        Customers Table
      </EntityMarkdownLink>
    );

    const link = screen.getByText('Customers Table');

    expect(link).toBeInTheDocument();
  });

  it('should render entity link for dashboard entity format', () => {
    renderWithRouter(
      <EntityMarkdownLink href="#dashboard/sample.dashboard.metrics">
        Metrics Dashboard
      </EntityMarkdownLink>
    );

    const link = screen.getByText('Metrics Dashboard');

    expect(link).toBeInTheDocument();
  });

  it('should handle URL-encoded entity names', () => {
    renderWithRouter(
      <EntityMarkdownLink href="#table/sample.table%20with%20spaces">
        Table with Spaces
      </EntityMarkdownLink>
    );

    const link = screen.getByText('Table with Spaces');

    expect(link).toBeInTheDocument();
  });

  it('should render regular link for invalid entity format', () => {
    renderWithRouter(
      <EntityMarkdownLink href="#invalid-format">
        Invalid Format
      </EntityMarkdownLink>
    );

    const link = screen.getByText('Invalid Format');

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '#invalid-format');
  });

  it('should render regular link for unknown entity type', () => {
    renderWithRouter(
      <EntityMarkdownLink href="#unknowntype/some.entity">
        Unknown Type
      </EntityMarkdownLink>
    );

    const link = screen.getByText('Unknown Type');

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '#unknowntype/some.entity');
  });
});
