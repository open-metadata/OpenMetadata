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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
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

  // In AI mode a team link is `<current search>#members/teams/<fqn>`: it must
  // follow the page's query string, not keep the one it first rendered with.
  it('rebuilds a settings link when the page query string changes', () => {
    const defaultGetEntityLink = mockGetEntityLink.getMockImplementation();
    mockGetEntityLink.mockImplementation(
      (_type: string, fqn: string) =>
        `${globalThis.location.search}#members/teams/${fqn}`
    );
    let navigate: ReturnType<typeof useNavigate> = jest.fn();
    const NavigateProbe = () => {
      navigate = useNavigate();

      return null;
    };
    globalThis.history.pushState({}, '', '/table/t?q=1');

    renderWithRouter(
      <>
        <NavigateProbe />
        <EntityMarkdownLink href="#team/Engineering">
          Engineering
        </EntityMarkdownLink>
      </>
    );

    expect(screen.getByText('Engineering')).toHaveAttribute(
      'href',
      '/table/t?q=1#members/teams/Engineering'
    );

    act(() => navigate('/table/t?q=2'));

    expect(screen.getByText('Engineering')).toHaveAttribute(
      'href',
      '/table/t?q=2#members/teams/Engineering'
    );

    if (defaultGetEntityLink) {
      mockGetEntityLink.mockImplementation(defaultGetEntityLink);
    }
    globalThis.history.pushState({}, '', '/');
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

  it('opens the entity page in a new tab on cmd/ctrl click', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    renderWithRouter(
      <EntityMarkdownLink href="#table/red.dev.dbt_jaffle.customers">
        Customers Table
      </EntityMarkdownLink>
    );

    fireEvent.click(screen.getByText('Customers Table'), { metaKey: true });

    expect(openSpy).toHaveBeenCalledWith(
      '/entity/table/red.dev.dbt_jaffle.customers',
      '_blank'
    );

    openSpy.mockRestore();
  });

  it('opens the entity page in a new tab on ctrl click', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    renderWithRouter(
      <EntityMarkdownLink href="#table/red.dev.dbt_jaffle.customers">
        Customers Table
      </EntityMarkdownLink>
    );

    fireEvent.click(screen.getByText('Customers Table'), { ctrlKey: true });

    expect(openSpy).toHaveBeenCalledWith(
      '/entity/table/red.dev.dbt_jaffle.customers',
      '_blank'
    );

    openSpy.mockRestore();
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

  // Regression: a markdown link destination that contains a percent escape
  // `decodeURIComponent` cannot parse (e.g. `%zz`, `%2z`) used to throw a
  // render-time URIError, which the AppRoot ErrorBoundary turned into a
  // full-page crash. safeDecodeURIComponent keeps the raw value instead, so
  // the link renders normally.
  describe('malformed percent-encoding must not crash render', () => {
    it('renders a #table link with a %zz escape instead of throwing', () => {
      renderWithRouter(
        <EntityMarkdownLink href="#table/bad%zz">Crash Me</EntityMarkdownLink>
      );

      expect(screen.getByText('Crash Me')).toBeInTheDocument();
      // Decoding fails, so the raw FQN is kept and passed to the link builder.
      expect(mockGetEntityLink).toHaveBeenCalledWith(
        EntityType.TABLE,
        'bad%zz',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
    });

    it('renders an ingestionPipeline link with malformed percent escapes without throwing', () => {
      renderWithRouter(
        <EntityMarkdownLink href="#ingestionPipeline/databaseServices/bad%zz/bad%zz.pipeline">
          Pod Diagnostics
        </EntityMarkdownLink>
      );

      expect(screen.getByText('Pod Diagnostics')).toBeInTheDocument();
      expect(mockGetEntityLink).toHaveBeenCalledWith(
        EntityType.INGESTION_PIPELINE,
        'bad%zz.pipeline',
        undefined,
        undefined,
        undefined,
        undefined,
        'databaseServices',
        'bad%zz'
      );
    });

    it('renders a #document link with a malformed percent escape without throwing', async () => {
      mockListContextFiles.mockResolvedValue({ data: [{ id: 'doc-1' }] });

      renderWithRouter(
        <EntityMarkdownLink href="#document/bad%zz">
          report.csv
        </EntityMarkdownLink>
      );

      // The asset id keeps its raw value and is still looked up.
      await waitFor(() =>
        expect(mockListContextFiles).toHaveBeenCalledWith({
          assetId: 'bad%zz',
          limit: 1,
        })
      );

      expect(screen.getByText('report.csv')).toBeInTheDocument();
    });

    it('does not throw when rendered through the real react-markdown pipeline', () => {
      // This is the production path: react-markdown hands the raw href to the
      // custom `a` renderer (EntityMarkdownLink). Nothing rewrites `%zz`,
      // so this exercises the exact surface that used to crash the page.
      const Markdown = require('react-markdown').default;
      const { getCustomMarkdownComponents } = require('../markdownComponents');

      renderWithRouter(
        <Markdown components={getCustomMarkdownComponents()}>
          [danger](#table/bad%zz)
        </Markdown>
      );

      expect(screen.getByText('danger')).toBeInTheDocument();
    });

    it('does not throw for a #document link rendered through the real react-markdown pipeline', async () => {
      mockListContextFiles.mockResolvedValue({ data: [{ id: 'doc-1' }] });

      const Markdown = require('react-markdown').default;
      const { getCustomMarkdownComponents } = require('../markdownComponents');

      renderWithRouter(
        <Markdown components={getCustomMarkdownComponents()}>
          [file](#document/bad%zz)
        </Markdown>
      );

      await waitFor(() =>
        expect(mockListContextFiles).toHaveBeenCalledWith({
          assetId: 'bad%zz',
          limit: 1,
        })
      );

      expect(screen.getByText('file')).toBeInTheDocument();
    });
  });
});
