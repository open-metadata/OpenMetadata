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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OntologyNode } from '../../components/OntologyExplorer/OntologyExplorer.interface';
import { ProjectionState, RDFStatus } from '../../generated/api/rdf/rdfStatus';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import {
  getGlossariesList,
  getGlossaryTerms,
  getOntologySummary,
} from '../../rest/glossaryAPI';
import { getMetrics } from '../../rest/metricsAPI';
import { listRelationshipTypes } from '../../rest/ontologyAPI';
import {
  checkRdfEnabled,
  fetchRdfConfig,
  getSavedSparqlQueries,
  getSparqlQueryTemplates,
} from '../../rest/rdfAPI';
import OntologyExplorerPage from './OntologyExplorerPage';

jest.mock('../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: true, isFirstTimeUser: false }),
}));
jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { name: 'admin' } }),
}));
jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));
jest.mock('../../components/common/DocumentTitle/DocumentTitle', () => ({
  __esModule: true,
  default: () => null,
}));

// jsdom cannot draw the G6 canvas; keep the real explorer, data hook and graph builders.
jest.mock('../../components/OntologyExplorer/OntologyGraphG6', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: forwardRef(({ nodes }: { nodes: OntologyNode[] }, _ref) => (
      <div data-testid="graph-nodes">
        {nodes.map((node) => (
          <span key={node.id}>{node.label}</span>
        ))}
      </div>
    )),
  };
});
jest.mock('@uiw/react-codemirror', () => ({
  __esModule: true,
  default: () => <div data-testid="query-editor" />,
}));
jest.mock('../../rest/glossaryAPI');
jest.mock('../../rest/metricsAPI');
jest.mock('../../rest/ontologyAPI');
jest.mock('../../rest/rdfAPI');

const mockGetGlossariesList = getGlossariesList as jest.MockedFunction<
  typeof getGlossariesList
>;
const mockGetGlossaryTerms = getGlossaryTerms as jest.MockedFunction<
  typeof getGlossaryTerms
>;
const mockGetMetrics = getMetrics as jest.MockedFunction<typeof getMetrics>;
const mockListRelationshipTypes = listRelationshipTypes as jest.MockedFunction<
  typeof listRelationshipTypes
>;
const mockGetSavedSparqlQueries = getSavedSparqlQueries as jest.MockedFunction<
  typeof getSavedSparqlQueries
>;
const mockGetSparqlQueryTemplates =
  getSparqlQueryTemplates as jest.MockedFunction<
    typeof getSparqlQueryTemplates
  >;
const mockGetOntologySummary = getOntologySummary as jest.MockedFunction<
  typeof getOntologySummary
>;
const mockCheckRdfEnabled = checkRdfEnabled as jest.MockedFunction<
  typeof checkRdfEnabled
>;
const mockFetchRdfConfig = fetchRdfConfig as jest.MockedFunction<
  typeof fetchRdfConfig
>;

const glossary: Glossary = {
  description: 'Financial concepts',
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Finance',
  fullyQualifiedName: 'Finance',
  termCount: 2,
};
const rdfStatus: RDFStatus = {
  askCollateEnabled: false,
  baseUri: 'https://open-metadata.org/',
  enabled: true,
  inference: {
    availableLevels: ['none'],
    defaultLevel: 'none',
    enabled: false,
  },
  projectionState: ProjectionState.Ready,
  storageType: 'FUSEKI',
};
const terms: GlossaryTerm[] = ['Account', 'Loan'].map((name, index) => ({
  description: name,
  id: `20000000-0000-4000-8000-00000000000${index + 1}`,
  name,
  fullyQualifiedName: `${glossary.name}.${name}`,
  glossary: { id: glossary.id, name: glossary.name, type: 'glossary' },
}));
terms[0].relatedTerms = [
  {
    relationType: 'relatedTo',
    term: {
      id: terms[1].id,
      type: 'glossaryTerm',
      name: terms[1].name,
      fullyQualifiedName: terms[1].fullyQualifiedName,
    },
  },
];

describe('Ontology Studio mode-switch integration', () => {
  beforeEach(() => {
    mockGetGlossariesList.mockResolvedValue({
      data: [glossary],
      paging: { total: 1 },
    });
    mockGetGlossaryTerms.mockResolvedValue({
      data: terms,
      paging: { total: terms.length },
    });
    mockGetMetrics.mockResolvedValue({ data: [], paging: { total: 0 } });
    mockListRelationshipTypes.mockResolvedValue({ data: [], paging: {} });
    mockGetSavedSparqlQueries.mockResolvedValue([]);
    mockGetSparqlQueryTemplates.mockResolvedValue([]);
    mockGetOntologySummary.mockResolvedValue({
      connectedPercentage: 100,
      isolatedPreview: [],
      isolatedTerms: 0,
      paging: { limit: 5, offset: 0, total: 0 },
      totalRelations: 1,
      totalTerms: 2,
    });
  });

  it.each([true, false])(
    'keeps loaded terms, relations and search when Query is visited (RDF enabled: %s)',
    async (rdfEnabled) => {
      mockCheckRdfEnabled.mockResolvedValue(rdfEnabled);
      mockFetchRdfConfig.mockResolvedValue({
        ...rdfStatus,
        enabled: rdfEnabled,
      });
      render(
        <MemoryRouter>
          <OntologyExplorerPage />
        </MemoryRouter>
      );

      await waitFor(() =>
        expect(screen.getByTestId('graph-nodes')).toHaveTextContent('Account')
      );
      const graph = screen.getByTestId('graph-nodes');
      const stats = screen.getByTestId('ontology-explorer-stats');
      const search = screen.getByTestId('ontology-graph-search');

      expect(graph).toHaveTextContent('Loan');
      expect(stats).toHaveTextContent(
        '2 label.term-plural · 1 label.relation-plural'
      );

      fireEvent.change(search, { target: { value: 'Account' } });

      // A tab change must not depend on a second catalog fetch completing.
      mockGetGlossariesList.mockImplementation(
        () => new Promise(() => undefined)
      );

      fireEvent.click(screen.getByTestId('mode-tab-edit'));
      fireEvent.click(screen.getByTestId('mode-tab-query'));
      await waitFor(() =>
        expect(
          screen.getByTestId(
            rdfEnabled
              ? 'ontology-studio-query-console'
              : 'ontology-rdf-disabled-notice'
          )
        ).toBeVisible()
      );
      fireEvent.click(screen.getByTestId('mode-tab-edit'));
      fireEvent.click(screen.getByTestId('mode-tab-view'));

      expect(
        screen.queryByTestId('ontology-graph-loading')
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('graph-nodes')).toBe(graph);
      expect(graph).toBeVisible();
      expect(stats).toHaveTextContent(
        '2 label.term-plural · 1 label.relation-plural'
      );
      expect(screen.getByTestId('ontology-graph-search')).toHaveValue(
        'Account'
      );
      expect(getGlossariesList).toHaveBeenCalledTimes(1);
    }
  );

  it('finishes the original load after leaving and returning to the graph', async () => {
    mockCheckRdfEnabled.mockResolvedValue(false);
    mockFetchRdfConfig.mockResolvedValue({ ...rdfStatus, enabled: false });
    let resolveTerms:
      | ((value: Awaited<ReturnType<typeof getGlossaryTerms>>) => void)
      | undefined;
    mockGetGlossaryTerms.mockReturnValue(
      new Promise((resolve) => {
        resolveTerms = resolve;
      })
    );
    render(
      <MemoryRouter>
        <OntologyExplorerPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(getGlossaryTerms).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('mode-tab-query'));

    await act(async () =>
      resolveTerms?.({ data: terms, paging: { total: terms.length } })
    );
    fireEvent.click(screen.getByTestId('mode-tab-view'));

    expect(
      screen.queryByTestId('ontology-graph-loading')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('graph-nodes')).toHaveTextContent('Account');
    expect(screen.getByTestId('graph-nodes')).toHaveTextContent('Loan');
    expect(getGlossariesList).toHaveBeenCalledTimes(1);
  });
});
