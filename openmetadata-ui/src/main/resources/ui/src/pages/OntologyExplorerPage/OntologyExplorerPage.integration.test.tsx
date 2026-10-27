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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { applyPatch } from 'fast-json-patch';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { OntologyNode } from '../../components/OntologyExplorer/OntologyExplorer.interface';
import { ProjectionState, RDFStatus } from '../../generated/api/rdf/rdfStatus';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Ontology } from '../../generated/entity/data/ontology';
import { OntologyConceptType } from '../../generated/entity/data/ontologyConcept';
import {
  Kind,
  OntologyProperty,
} from '../../generated/entity/data/ontologyProperty';
import {
  getGlossariesList,
  getGlossaryTerms,
  getOntologySummary,
} from '../../rest/glossaryAPI';
import { getMetrics } from '../../rest/metricsAPI';
import {
  createOntology,
  getOntology,
  getOntologyConceptBindings,
  listOntologies,
  listOntologyAxioms,
  listOntologyConcepts,
  listOntologyProperties,
  listRelationshipTypes,
  patchOntology,
  patchOntologyProperty,
} from '../../rest/ontologyAPI';
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
  useApplicationStore: (
    selector?: (store: {
      currentUser: { id: string; displayName: string; name: string };
    }) => unknown
  ) => {
    const store = {
      currentUser: { id: 'admin', displayName: 'Admin User', name: 'admin' },
    };

    return selector ? selector(store) : store;
  },
}));
jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));
jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: () => ({ canEditAll: true, hasViewAccess: true }),
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
    default: forwardRef(
      (
        {
          nodes,
          onNodeClick,
        }: { nodes: OntologyNode[]; onNodeClick: (node: OntologyNode) => void },
        _ref
      ) => (
        <div data-testid="graph-nodes">
          {nodes.map((node) => (
            <button key={node.id} onClick={() => onNodeClick(node)}>
              {node.label}
            </button>
          ))}
        </div>
      )
    ),
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
const mockGetOntology = getOntology as jest.MockedFunction<typeof getOntology>;
const mockCreateOntology = createOntology as jest.MockedFunction<
  typeof createOntology
>;
const mockListOntologies = listOntologies as jest.MockedFunction<
  typeof listOntologies
>;
const mockListOntologyConcepts = listOntologyConcepts as jest.MockedFunction<
  typeof listOntologyConcepts
>;
const mockListOntologyProperties =
  listOntologyProperties as jest.MockedFunction<typeof listOntologyProperties>;
const mockListOntologyAxioms = listOntologyAxioms as jest.MockedFunction<
  typeof listOntologyAxioms
>;
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
  aiEnabled: false,
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
  let queryClient: QueryClient;

  beforeEach(() => {
    (
      getOntologyConceptBindings as jest.MockedFunction<
        typeof getOntologyConceptBindings
      >
    ).mockResolvedValue({ revision: 0, assets: [] });
    mockListOntologies.mockResolvedValue({ data: [], paging: { total: 0 } });
    mockListOntologyConcepts.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockListOntologyProperties.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockListOntologyAxioms.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
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

  it.each(['/', '/?ontology=retail'])(
    'only offers ontology scopes in the native menu at %s',
    async (route) => {
      const ontology: Ontology = {
        id: 'retail',
        name: 'Retail',
        fullyQualifiedName: 'Retail',
        iri: 'urn:retail',
        namespace: 'urn:retail:',
      };
      mockGetOntology.mockResolvedValue(ontology);
      mockListOntologies.mockResolvedValue({
        data: [ontology],
        paging: { total: 1 },
      });
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            <OntologyExplorerPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
      const menu = within(await screen.findByRole('menu'));

      expect(
        await menu.findByRole('menuitemradio', { name: /Retail/ })
      ).toBeVisible();
      expect(menu.getByTestId('ontology-scope-all-ontologies')).toBeVisible();
      expect(menu.getByTestId('ontology-create')).toBeVisible();
      expect(
        menu.queryByTestId('ontology-scope-all-glossaries')
      ).not.toBeInTheDocument();
      expect(
        menu.queryByRole('menuitemradio', { name: /Finance/ })
      ).not.toBeInTheDocument();
      expect(mockGetGlossariesList).not.toHaveBeenCalled();
    }
  );

  it('keeps the native inspector and selection across aggregate tree, owner Edit, and Query', async () => {
    const ontology: Ontology = {
      id: 'retail',
      name: 'Retail',
      fullyQualifiedName: 'Retail',
      iri: 'urn:retail',
      namespace: 'urn:retail:',
    };
    mockGetOntology.mockResolvedValue(ontology);
    mockListOntologies.mockResolvedValue({
      data: [ontology],
      paging: { total: 1 },
    });
    mockListOntologyConcepts.mockResolvedValue({
      data: [
        {
          id: 'customer',
          name: 'Customer',
          fullyQualifiedName: 'Retail.Customer',
          iri: 'urn:retail:Customer',
          conceptType: OntologyConceptType.OwlClass,
          ontology: { id: ontology.id, type: 'ontology' },
          description: 'A person who buys goods.',
        },
      ],
      paging: { total: 1 },
    });
    const Location = () => (
      <output data-testid="location">{useLocation().search}</output>
    );
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OntologyExplorerPage />
          <Location />
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Customer' }));

    expect(screen.getByTestId('ontology-concept-inspector')).toHaveTextContent(
      'urn:retail:Customer'
    );
    expect(screen.queryByTestId('ontology-open-owner')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'label.tree' }));

    expect(screen.getByTestId('ontology-concept-inspector')).toHaveTextContent(
      'A person who buys goods.'
    );

    fireEvent.click(screen.getByTestId('mode-tab-edit'));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        'ontology=retail'
      )
    );

    expect(screen.getByTestId('location')).toHaveTextContent(
      'concept=customer'
    );
    expect(
      await screen.findByTestId('ontology-concept-inspector')
    ).toHaveTextContent('urn:retail:Customer');
    expect(mockGetOntology).toHaveBeenCalledWith(
      ontology.id,
      'owners,reviewers',
      expect.any(AbortSignal)
    );
    expect(mockListOntologyConcepts).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('mode-tab-query'));

    expect(
      await screen.findByTestId('ontology-studio-query-console')
    ).toBeVisible();

    fireEvent.click(screen.getByTestId('mode-tab-view'));

    expect(
      await screen.findByTestId('ontology-concept-inspector')
    ).toHaveTextContent('urn:retail:Customer');
    expect(mockListOntologyConcepts).toHaveBeenCalledTimes(2);
  });

  it('shows saved Definitions in the owner and aggregate concept inspectors', async () => {
    const ontology: Ontology = {
      id: 'retail',
      name: 'Retail',
      fullyQualifiedName: 'Retail',
      iri: 'urn:retail',
      namespace: 'urn:retail:',
    };
    let property: OntologyProperty = {
      id: 'customer-number',
      name: 'customerNumber',
      displayName: 'Customer number',
      fullyQualifiedName: 'Retail.customerNumber',
      iri: 'urn:retail:customerNumber',
      kind: Kind.Data,
      ontology: { id: ontology.id, type: 'ontology' },
      domain: ['urn:retail:Customer'],
      range: ['http://www.w3.org/2001/XMLSchema#integer'],
    };
    mockGetOntology.mockResolvedValue(ontology);
    mockListOntologies.mockResolvedValue({
      data: [ontology],
      paging: { total: 1 },
    });
    mockListOntologyConcepts.mockResolvedValue({
      data: [
        {
          id: 'customer',
          name: 'Customer',
          fullyQualifiedName: 'Retail.Customer',
          iri: 'urn:retail:Customer',
          conceptType: OntologyConceptType.OwlClass,
          ontology: { id: ontology.id, type: 'ontology' },
        },
      ],
      paging: { total: 1 },
    });
    mockListOntologyProperties.mockImplementation(async () => ({
      data: [property],
      paging: { total: 1 },
    }));
    (
      patchOntologyProperty as jest.MockedFunction<typeof patchOntologyProperty>
    ).mockImplementation(async (_id, patch) => {
      property = applyPatch(property, patch, false, false).newDocument;

      return property;
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OntologyExplorerPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Customer' }));

    expect(screen.getByTestId('ontology-concept-properties')).toHaveTextContent(
      'Customer number'
    );

    fireEvent.click(screen.getByTestId('mode-tab-edit'));
    await waitFor(() =>
      expect(
        screen.getByTestId('ontology-concept-properties')
      ).toHaveTextContent('Customer number')
    );
    fireEvent.click(await screen.findByTestId('submode-tab-definitions'));
    fireEvent.click(screen.getByRole('tab', { name: 'label.property-plural' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Customer number' })
    );
    const editor = within(
      await screen.findByTestId('ontology-property-editor')
    );
    fireEvent.change(
      editor.getByRole('textbox', { name: 'label.display-name' }),
      {
        target: { value: 'Customer ID' },
      }
    );
    fireEvent.click(editor.getByRole('button', { name: 'label.save' }));
    await screen.findByRole('button', { name: 'Customer ID' });
    fireEvent.click(screen.getByTestId('submode-tab-graph'));
    await waitFor(() =>
      expect(
        screen.getByTestId('ontology-concept-properties')
      ).toHaveTextContent('Customer ID')
    );
    fireEvent.click(screen.getByTestId('mode-tab-view'));
    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
    fireEvent.click(screen.getByTestId('ontology-scope-all-ontologies'));
    await screen.findByTestId('all-ontologies-graph');
    fireEvent.click(await screen.findByRole('button', { name: 'Customer' }));
    await waitFor(() =>
      expect(
        screen.getByTestId('ontology-concept-properties')
      ).toHaveTextContent('Customer ID')
    );
  });

  it('includes a newly created native ontology when returning to All', async () => {
    const ontology: Ontology = {
      id: 'new-native',
      name: 'NewNative',
      fullyQualifiedName: 'NewNative',
      iri: 'urn:new',
      namespace: 'urn:new:',
    };
    let catalog: Ontology[] = [];
    mockListOntologies.mockImplementation(async () => ({
      data: catalog,
      paging: { total: catalog.length },
    }));
    mockCreateOntology.mockImplementation(async () => {
      catalog = [ontology];

      return ontology;
    });
    mockGetOntology.mockResolvedValue(ontology);
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OntologyExplorerPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByTestId('all-ontologies-empty')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'label.new-entity' }));
    await screen.findByTestId('ontology-create-form');
    fireEvent.change(screen.getByRole('textbox', { name: 'label.name' }), {
      target: { value: ontology.name },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: 'label.ontology-iri' }),
      { target: { value: ontology.iri } }
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'label.namespace' }), {
      target: { value: ontology.namespace },
    });
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));
    await waitFor(() =>
      expect(screen.getByTestId('ontology-scope-menu-trigger')).toHaveAttribute(
        'data-scope-key',
        'ontology:new-native'
      )
    );
    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
    fireEvent.click(screen.getByTestId('ontology-scope-all-ontologies'));

    expect(await screen.findByTestId('all-ontologies-graph')).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-publication-trigger'));

    expect(
      screen.getByTestId('ontology-publication-select-new-native')
    ).toBeVisible();
  });

  it.each(['pending', 'resolved'])(
    'hydrates Settings from detail when the request is %s',
    async (status) => {
      const header: Ontology = {
        id: 'retail',
        name: 'Retail',
        fullyQualifiedName: 'Retail',
        iri: 'urn:retail',
        namespace: 'urn:retail:',
        version: 0.3,
      };
      let resolveDetail: ((ontology: Ontology) => void) | undefined;
      mockGetOntology.mockReturnValue(
        new Promise((resolve) => {
          resolveDetail = resolve;
        })
      );
      mockListOntologies.mockResolvedValue({
        data: [header],
        paging: { total: 1 },
      });
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <OntologyExplorerPage />
          </MemoryRouter>
        </QueryClientProvider>
      );
      await screen.findByTestId('all-ontologies-graph');
      fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
      fireEvent.click(await screen.findByTestId('ontology-scope-retail'));

      if (status === 'pending') {
        const edit = screen.queryByTestId('mode-tab-edit');
        if (edit) {
          fireEvent.click(edit);
        }
        const definitions = screen.queryByTestId('submode-tab-definitions');
        if (definitions) {
          fireEvent.click(definitions);
          fireEvent.click(
            screen.getByRole('tab', { name: 'label.setting-plural' })
          );
        }

        expect(
          screen.queryByTestId('ontology-create-form')
        ).not.toBeInTheDocument();

        return;
      }

      await act(async () => {
        resolveDetail?.({
          ...header,
          owners: [{ id: 'owner', type: 'user', name: 'Saved owner' }],
          reviewers: [{ id: 'reviewer', type: 'user', name: 'Saved reviewer' }],
        });
      });
      fireEvent.click(await screen.findByTestId('mode-tab-edit'));
      fireEvent.click(await screen.findByTestId('submode-tab-definitions'));
      fireEvent.click(
        await screen.findByRole('tab', { name: 'label.setting-plural' })
      );

      const form = within(await screen.findByTestId('ontology-create-form'));

      expect(form.getByText('Saved owner')).toBeVisible();
      expect(form.getByText('Saved reviewer')).toBeVisible();
    }
  );

  it('reloads complete Settings detail after saving the same ontology ID', async () => {
    const header: Ontology = {
      id: 'retail',
      name: 'Retail',
      fullyQualifiedName: 'Retail',
      iri: 'urn:retail',
      namespace: 'urn:retail:',
      version: 0.3,
    };
    const detail: Ontology = {
      ...header,
      owners: [{ id: 'owner', type: 'user', name: 'Saved owner' }],
      reviewers: [{ id: 'reviewer', type: 'user', name: 'Saved reviewer' }],
    };
    mockListOntologies.mockResolvedValue({
      data: [header],
      paging: { total: 1 },
    });
    mockGetOntology
      .mockResolvedValueOnce(detail)
      .mockResolvedValue({ ...detail, displayName: 'Retail model' });
    (
      patchOntology as jest.MockedFunction<typeof patchOntology>
    ).mockResolvedValue({ ...header, displayName: 'Retail model' });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OntologyExplorerPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await screen.findByTestId('all-ontologies-graph');
    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
    fireEvent.click(await screen.findByTestId('ontology-scope-retail'));
    fireEvent.click(await screen.findByTestId('mode-tab-edit'));
    fireEvent.click(await screen.findByTestId('submode-tab-definitions'));
    fireEvent.click(
      await screen.findByRole('tab', { name: 'label.setting-plural' })
    );
    const form = within(await screen.findByTestId('ontology-create-form'));

    expect(form.getByText('Saved owner')).toBeVisible();

    fireEvent.change(
      form.getByRole('textbox', { name: 'label.display-name' }),
      { target: { value: 'Retail model' } }
    );
    fireEvent.click(form.getByRole('button', { name: 'label.save' }));
    await waitFor(() =>
      expect(
        screen.getByTestId('ontology-scope-menu-trigger')
      ).toHaveTextContent('Retail model')
    );
    fireEvent.click(screen.getByTestId('mode-tab-edit'));
    fireEvent.click(await screen.findByTestId('submode-tab-definitions'));
    fireEvent.click(
      await screen.findByRole('tab', { name: 'label.setting-plural' })
    );

    expect(await screen.findByText('Saved owner')).toBeVisible();
    expect(screen.getByText('Saved reviewer')).toBeVisible();
    expect(mockGetOntology).toHaveBeenCalledTimes(2);
  });

  it.each([403, 404])(
    'preserves failed native deep links and exposes recovery for %s',
    async (status) => {
      mockGetOntology.mockRejectedValueOnce({ response: { status } });
      mockCheckRdfEnabled.mockResolvedValue(false);
      mockFetchRdfConfig.mockResolvedValue({ ...rdfStatus, enabled: false });
      const Location = () => (
        <output data-testid="location">{useLocation().search}</output>
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={[
              '/?ontology=unavailable&draft=native-draft&source=context-center',
            ]}>
            <OntologyExplorerPage />
            <Location />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('label.loading')).toBeVisible();

      expect(await screen.findByRole('alert')).toBeVisible();
      expect(screen.queryByTestId('graph-nodes')).not.toBeInTheDocument();
      expect(screen.getByTestId('location')).toHaveTextContent(
        'ontology=unavailable'
      );
      expect(screen.getByRole('button', { name: 'label.retry' })).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'label.all-entity' }));
      await waitFor(() =>
        expect(screen.getByTestId('location')).not.toHaveTextContent(
          'ontology='
        )
      );
    }
  );

  it.each([true, false])(
    'keeps loaded terms, relations and search when Query is visited (RDF enabled: %s)',
    async (rdfEnabled) => {
      mockCheckRdfEnabled.mockResolvedValue(rdfEnabled);
      mockFetchRdfConfig.mockResolvedValue({
        ...rdfStatus,
        enabled: rdfEnabled,
      });
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/?scope=glossary:all']}>
            <OntologyExplorerPage />
          </MemoryRouter>
        </QueryClientProvider>
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
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/?scope=glossary:all']}>
          <OntologyExplorerPage />
        </MemoryRouter>
      </QueryClientProvider>
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
