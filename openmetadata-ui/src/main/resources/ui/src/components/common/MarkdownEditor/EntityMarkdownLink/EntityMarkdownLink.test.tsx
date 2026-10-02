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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import EntityMarkdownLink from './EntityMarkdownLink';

const mockListContextFiles = jest.fn();

jest.mock('../../../../rest/assetAPI', () => ({
  listContextFiles: (...args: unknown[]) => mockListContextFiles(...args),
}));

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
    // Mirror the real getEntityLink: an ingestion-pipeline link routes to the
    // owning service's agents tab (`/service/<serviceCategory>/<serviceFqn>/agents`)
    // using the service FQN — not a /logs path built from the pipeline FQN.
    if (serviceCategory && serviceFqn) {
      return `/service/${serviceCategory}/${encodeURIComponent(
        serviceFqn
      )}/agents`;
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
    getEntityTypes: () => Object.values(EntityType),
  },
}));

describe('EntityMarkdownLink', () => {
  const renderWithRouter = (component: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{component}</BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('document links', () => {
    const assetId = 'a0fe2d87-bd0d-4d6c-982e-a3dfc025aa1b';

    it('opens the Context Center document that is a view of the asset', async () => {
      // The chat knows an upload only by its asset id; the document that shows it is looked up.
      mockListContextFiles.mockResolvedValue({ data: [{ id: 'doc-1' }] });

      renderWithRouter(
        <EntityMarkdownLink href={`#document/${assetId}`}>
          campaign_contacts.csv
        </EntityMarkdownLink>
      );

      await waitFor(() =>
        expect(screen.getByText('campaign_contacts.csv')).toHaveAttribute(
          'href',
          '/context-center/documents?document=doc-1'
        )
      );

      expect(mockListContextFiles).toHaveBeenCalledWith({ assetId, limit: 1 });
    });

    it('renders plain text when no document shows the asset', async () => {
      // An upload never sent, or a document since deleted: a link that goes nowhere is worse
      // than none.
      mockListContextFiles.mockResolvedValue({ data: [] });

      renderWithRouter(
        <EntityMarkdownLink href={`#document/${assetId}`}>
          orphan.csv
        </EntityMarkdownLink>
      );

      await waitFor(() => expect(mockListContextFiles).toHaveBeenCalled());

      expect(screen.getByText('orphan.csv').closest('a')).toBeNull();
    });
  });

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

    it('should parse ingestionPipeline link into the full pipeline FQN and pass serviceCategory and serviceFqn', () => {
      renderWithRouter(
        <EntityMarkdownLink href="#ingestionPipeline/databaseServices/bigquery-beta/bigquery-beta-1.7047fd1d-f7a0-42d3-b689-33ab54faaccc">
          Pod Diagnostics
        </EntityMarkdownLink>
      );

      // The full FQN (<serviceFqn>.<pipelineName>) is what the hover popover
      // fetches the pipeline by; serviceCategory/serviceFqn drive the click route.
      expect(mockGetEntityLink).toHaveBeenCalledWith(
        EntityType.INGESTION_PIPELINE,
        'bigquery-beta.bigquery-beta-1.7047fd1d-f7a0-42d3-b689-33ab54faaccc',
        undefined,
        undefined,
        undefined,
        undefined,
        'databaseServices',
        'bigquery-beta'
      );

      // The popover must receive the full FQN so its getEntityByFqn call resolves
      // the pipeline rather than 404ing on the bare pipeline name.
      expect(screen.getByTestId('entity-popover-card')).toHaveAttribute(
        'data-fqn',
        'bigquery-beta.bigquery-beta-1.7047fd1d-f7a0-42d3-b689-33ab54faaccc'
      );
    });

    it('should route the ingestionPipeline link to the owning service agents tab', () => {
      renderWithRouter(
        <EntityMarkdownLink href="#ingestionPipeline/databaseServices/bigquery-beta/bigquery-beta-1.7047fd1d-f7a0-42d3-b689-33ab54faaccc">
          Pod Diagnostics
        </EntityMarkdownLink>
      );

      const link = screen.getByText('Pod Diagnostics');

      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute(
        'href',
        '/service/databaseServices/bigquery-beta/agents'
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

    it('should render regular link when ingestionPipeline href has too many segments', () => {
      // A literal '/' in a name is encoded as %2F upstream, so four '/' segments
      // are malformed; the parser rejects them rather than building an ambiguous
      // FQN that the popover can't resolve.
      renderWithRouter(
        <EntityMarkdownLink href="#ingestionPipeline/databaseServices/bigquery-beta/bigquery-beta-1.7047fd1d/extra">
          Bad Link
        </EntityMarkdownLink>
      );

      const link = screen.getByText('Bad Link');

      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        'href',
        '#ingestionPipeline/databaseServices/bigquery-beta/bigquery-beta-1.7047fd1d/extra'
      );
      expect(mockGetEntityLink).not.toHaveBeenCalled();
    });

    it('should decode URL-encoded characters and reconstruct the full ingestionPipeline FQN', () => {
      renderWithRouter(
        <EntityMarkdownLink href="#ingestionPipeline/databaseServices/my%20service/my%20pipeline">
          Encoded Pipeline
        </EntityMarkdownLink>
      );

      expect(mockGetEntityLink).toHaveBeenCalledWith(
        EntityType.INGESTION_PIPELINE,
        'my service.my pipeline',
        undefined,
        undefined,
        undefined,
        undefined,
        'databaseServices',
        'my service'
      );

      expect(screen.getByTestId('entity-popover-card')).toHaveAttribute(
        'data-fqn',
        'my service.my pipeline'
      );
    });
  });
});
