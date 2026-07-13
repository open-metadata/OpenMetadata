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

const mockGetEntityLink = jest.fn(
  (
    type: string,
    fqn: string,
    _tab?: string,
    _subTab?: string,
    _isExecutableTestSuite?: boolean,
    _isObservabilityAlert?: boolean,
    serviceCategory?: string,
    serviceFqn?: string
  ) => {
    // Mirror the real getEntityLink: the logs route is
    // `/<serviceCategory>/<pipelineFqn>/logs` (pipeline fqn, not the service fqn).
    if (serviceCategory && serviceFqn) {
      return `/${serviceCategory}/${fqn}/logs`;
    }

    return `/entity/${type}/${fqn}`;
  }
);

// Mock EntityUtilClassBase to control entity link resolution
jest.mock('../../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: (
      type: string,
      fqn: string,
      tab?: string,
      subTab?: string,
      isExecutableTestSuite?: boolean,
      isObservabilityAlert?: boolean,
      serviceCategory?: string,
      serviceFqn?: string
    ) =>
      mockGetEntityLink(
        type,
        fqn,
        tab,
        subTab,
        isExecutableTestSuite,
        isObservabilityAlert,
        serviceCategory,
        serviceFqn
      ),
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

  describe('ingestionPipeline entity links', () => {
    beforeEach(() => {
      mockGetEntityLink.mockClear();
    });

    it('should parse ingestionPipeline link and pass serviceCategory and serviceFqn', () => {
      renderWithRouter(
        <EntityMarkdownLink href="#ingestionPipeline/databaseServices/bigquery-beta/bigquery-beta-1.7047fd1d-f7a0-42d3-b689-33ab54faaccc">
          Pod Diagnostics
        </EntityMarkdownLink>
      );

      expect(mockGetEntityLink).toHaveBeenCalledWith(
        EntityType.INGESTION_PIPELINE,
        'bigquery-beta-1.7047fd1d-f7a0-42d3-b689-33ab54faaccc',
        undefined,
        undefined,
        undefined,
        undefined,
        'databaseServices',
        'bigquery-beta'
      );
    });

    it('should render entity link with correct logs path', () => {
      renderWithRouter(
        <EntityMarkdownLink href="#ingestionPipeline/databaseServices/bigquery-beta/bigquery-beta-1.7047fd1d-f7a0-42d3-b689-33ab54faaccc">
          Pod Diagnostics
        </EntityMarkdownLink>
      );

      const link = screen.getByText('Pod Diagnostics');

      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute(
        'href',
        '/databaseServices/bigquery-beta-1.7047fd1d-f7a0-42d3-b689-33ab54faaccc/logs'
      );
    });

    it('should render regular link when ingestionPipeline href is missing serviceFqn segment', () => {
      renderWithRouter(
        <EntityMarkdownLink href="#ingestionPipeline/databaseServices">
          Bad Link
        </EntityMarkdownLink>
      );

      const link = screen.getByText('Bad Link');

      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        'href',
        '#ingestionPipeline/databaseServices'
      );
    });

    it('should decode URL-encoded characters in ingestionPipeline FQN', () => {
      renderWithRouter(
        <EntityMarkdownLink href="#ingestionPipeline/databaseServices/my%20service/my%20service.pipeline-id">
          Encoded Pipeline
        </EntityMarkdownLink>
      );

      expect(mockGetEntityLink).toHaveBeenCalledWith(
        EntityType.INGESTION_PIPELINE,
        'my service.pipeline-id',
        undefined,
        undefined,
        undefined,
        undefined,
        'databaseServices',
        'my service'
      );
    });
  });
});
