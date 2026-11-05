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
import { Type } from '../../generated/api/rdf/sparqlResponse';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { useAuth } from '../../hooks/authHooks';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import {
  getSavedSparqlQueries,
  getSparqlQueryTemplates,
  replaceSavedSparqlQueries,
  replaceSparqlQueryTemplates,
  runGlossarySparqlQuery,
  runOntologySparqlQuery,
  runSparqlQuery,
  SavedSparqlQuery,
} from '../../rest/rdfAPI';
import { OntologyGraphData } from './OntologyExplorer.interface';
import OntologyStudioQueryConsole from './OntologyStudioQueryConsole';

interface SchemaEditorMockProps {
  value: string;
  onChange?: (value: string) => void;
}

interface OntologyGraphMockProps {
  edges: Array<{ from: string; to: string }>;
  nodes: Array<{ id: string }>;
}

jest.mock('../Database/SchemaEditor/SchemaEditor', () => ({
  __esModule: true,
  default: ({ value, onChange }: SchemaEditorMockProps) => (
    <textarea
      aria-label="schema editor"
      data-testid="schema-editor"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

jest.mock('./OntologyGraphG6', () => ({
  __esModule: true,
  default: ({ edges, nodes }: OntologyGraphMockProps) => (
    <div
      data-edge-count={edges.length}
      data-node-count={nodes.length}
      data-testid="query-result-g6"
    />
  ),
}));

jest.mock('../../rest/rdfAPI', () => ({
  getSavedSparqlQueries: jest.fn(),
  getSparqlQueryTemplates: jest.fn(),
  replaceSavedSparqlQueries: jest.fn(),
  replaceSparqlQueryTemplates: jest.fn(),
  runGlossarySparqlQuery: jest.fn(),
  runOntologySparqlQuery: jest.fn(),
  runSparqlQuery: jest.fn(),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockRunSparqlQuery = runSparqlQuery as jest.MockedFunction<
  typeof runSparqlQuery
>;
const mockRunGlossarySparqlQuery =
  runGlossarySparqlQuery as jest.MockedFunction<typeof runGlossarySparqlQuery>;
const mockGetSavedQueries = getSavedSparqlQueries as jest.MockedFunction<
  typeof getSavedSparqlQueries
>;
const mockGetQueryTemplates = getSparqlQueryTemplates as jest.MockedFunction<
  typeof getSparqlQueryTemplates
>;
const mockReplaceSavedQueries =
  replaceSavedSparqlQueries as jest.MockedFunction<
    typeof replaceSavedSparqlQueries
  >;
const mockReplaceQueryTemplates =
  replaceSparqlQueryTemplates as jest.MockedFunction<
    typeof replaceSparqlQueryTemplates
  >;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const QUERY_TEMPLATE: SavedSparqlQuery = {
  id: '692cb99a-96fd-4f47-8f28-3d7e471ff001',
  name: 'Installation glossary query',
  query: 'SELECT ?term WHERE { ?term a <urn:GlossaryTerm> }',
  format: 'json',
  inference: 'none',
  savedAt: 0,
};

const GRAPH_DATA: OntologyGraphData = {
  nodes: [
    {
      id: 'source',
      label: 'Operational Risk',
      type: 'glossaryTerm',
      glossaryId: 'glossary-1',
      fullyQualifiedName: 'Finance.Risk.OperationalRisk',
    },
    {
      id: 'target',
      label: 'Anti Money Laundering',
      type: 'glossaryTerm',
      glossaryId: 'glossary-1',
      fullyQualifiedName: 'Finance.Compliance.AntiMoneyLaundering',
    },
  ],
  edges: [
    {
      from: 'source',
      to: 'target',
      label: 'Related To',
      relationType: 'relatedTo',
    },
  ],
};

const RELATION_TYPES: RelationshipType[] = [
  createRelationshipTypeMock({
    name: 'relatedTo',
    displayName: 'Related To',
    rdfPredicate: 'https://open-metadata.org/ontology/relatedTo',
  }),
];

function renderConsole() {
  return render(
    <OntologyStudioQueryConsole
      graphData={GRAPH_DATA}
      relationTypes={RELATION_TYPES}
      selectedGlossaryIds={['glossary-1']}
    />
  );
}

describe('OntologyStudioQueryConsole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      isAdminUser: false,
      isFirstTimeUser: false,
    });
    mockGetSavedQueries.mockReturnValue(
      new Promise<SavedSparqlQuery[]>(() => undefined)
    );
    mockGetQueryTemplates.mockReturnValue(
      new Promise<SavedSparqlQuery[]>(() => undefined)
    );
    mockReplaceSavedQueries.mockImplementation(async (queries) => queries);
    mockReplaceQueryTemplates.mockImplementation(async (queries) => queries);
    mockRunSparqlQuery.mockResolvedValue({
      format: 'json',
      body: '',
      contentType: 'application/sparql-results+json',
      durationMs: 38,
      parsed: {
        head: { vars: ['c'] },
        results: {
          bindings: [
            {
              c: {
                type: Type.URI,
                value: 'https://open-metadata.org/entity/glossaryTerm/example',
              },
            },
          ],
        },
      },
    });
    mockRunGlossarySparqlQuery.mockResolvedValue({
      format: 'json',
      body: '',
      contentType: 'application/sparql-results+json',
      durationMs: 38,
      parsed: {
        head: { vars: ['c'] },
        results: {
          bindings: [
            {
              c: {
                type: Type.URI,
                value: 'https://open-metadata.org/entity/glossaryTerm/example',
              },
            },
          ],
        },
      },
    });
  });

  it('derives the compact Studio query rail from the ontology graph', () => {
    renderConsole();

    expect(screen.getByTestId('ontology-query-sample-rail')).toHaveClass(
      'tw:w-70'
    );
    expect(
      (screen.getByTestId('schema-editor') as HTMLTextAreaElement).value
    ).toContain('Finance.Compliance.AntiMoneyLaundering');
    expect(
      screen.getByTestId('ontology-query-suggestion-ontology-relatedTo-target')
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByText('Concepts regulated by AML')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-query-read-only')).toHaveTextContent(
      'label.shared-read-only'
    );
  });

  it('loads and runs an ontology-derived query from the rail', async () => {
    renderConsole();

    fireEvent.click(
      screen.getByTestId('ontology-query-suggestion-ontology-relatedTo-target')
    );

    await waitFor(() =>
      expect(mockRunGlossarySparqlQuery).toHaveBeenCalledWith(
        'glossary-1',
        expect.objectContaining({
          format: 'json',
          inference: 'none',
          query: expect.stringContaining(
            '<https://open-metadata.org/ontology/relatedTo>'
          ),
        })
      )
    );

    expect(
      await screen.findByTestId('ontology-sparql-chips')
    ).toHaveTextContent(
      'https://open-metadata.org/entity/glossaryTerm/example'
    );
  });

  it('renders an RDF 1.2 triple term instead of crashing the results panel', async () => {
    mockRunGlossarySparqlQuery.mockResolvedValue({
      format: 'json',
      body: '',
      contentType: 'application/sparql-results+json',
      durationMs: 12,
      parsed: {
        head: { vars: ['statement', 'source'] },
        results: {
          bindings: [
            {
              statement: {
                type: Type.Triple,
                value: {
                  subject: { type: Type.URI, value: 'urn:s' },
                  predicate: { type: Type.URI, value: 'urn:p' },
                  object: {
                    type: Type.Literal,
                    value: 'قطة',
                    'xml:lang': 'ar',
                    'its:dir': 'rtl',
                  },
                },
              },
              source: { type: Type.URI, value: 'urn:g' },
            },
          ],
        },
      },
    } as never);
    renderConsole();

    fireEvent.click(
      screen.getByTestId('ontology-query-suggestion-ontology-relatedTo-target')
    );

    expect(
      await screen.findByText('<<( <urn:s> <urn:p> "قطة"@ar--rtl )>>')
    ).toBeInTheDocument();
  });

  it('keeps unrestricted knowledge-graph queries admin-only', async () => {
    mockUseAuth.mockReturnValue({
      isAdminUser: true,
      isFirstTimeUser: false,
    });
    render(
      <OntologyStudioQueryConsole
        graphData={GRAPH_DATA}
        relationTypes={RELATION_TYPES}
        selectedGlossaryIds={[]}
      />
    );

    fireEvent.click(
      screen.getByTestId('ontology-query-suggestion-ontology-relatedTo-target')
    );

    await waitFor(() => expect(mockRunSparqlQuery).toHaveBeenCalled());

    expect(mockRunGlossarySparqlQuery).not.toHaveBeenCalled();
  });

  it('runs a native ontology query for a non-admin without requiring a glossary', async () => {
    const run = runOntologySparqlQuery as jest.MockedFunction<
      typeof runOntologySparqlQuery
    >;
    run.mockResolvedValue({
      format: 'json',
      body: '{}',
      contentType: 'application/sparql-results+json',
      durationMs: 1,
    });
    render(
      <OntologyStudioQueryConsole
        graphData={GRAPH_DATA}
        relationTypes={RELATION_TYPES}
        selectedGlossaryIds={[]}
        selectedOntologyId="native"
      />
    );
    fireEvent.click(
      screen.getByTestId('ontology-query-suggestion-ontology-relatedTo-target')
    );
    await waitFor(() =>
      expect(run).toHaveBeenCalledWith(
        'native',
        expect.objectContaining({ format: 'json' })
      )
    );

    expect(mockRunSparqlQuery).not.toHaveBeenCalled();
    expect(mockRunGlossarySparqlQuery).not.toHaveBeenCalled();
  });

  it('opens a native ontology on a class query its active release can answer', () => {
    render(
      <OntologyStudioQueryConsole
        graphData={null}
        relationTypes={[]}
        selectedGlossaryIds={[]}
        selectedOntologyId="native"
      />
    );

    const editor = screen.getByTestId('schema-editor') as HTMLTextAreaElement;

    expect(editor.value).toContain('?concept a owl:Class .');
    expect(editor.value).not.toContain('om:GlossaryTerm');
  });

  it('toggles triple-shaped query results from a table to a subgraph', async () => {
    mockRunGlossarySparqlQuery.mockResolvedValueOnce({
      body: '',
      contentType: 'application/sparql-results+json',
      durationMs: 12,
      format: 'json',
      parsed: {
        head: { vars: ['source', 'predicate', 'target'] },
        results: {
          bindings: [
            {
              predicate: {
                type: Type.URI,
                value: 'https://open-metadata.org/ontology/relatedTo',
              },
              source: { type: Type.URI, value: 'urn:source' },
              target: { type: Type.URI, value: 'urn:target' },
            },
          ],
        },
      },
    });
    renderConsole();

    fireEvent.click(
      screen.getByTestId('ontology-query-suggestion-ontology-relatedTo-target')
    );
    fireEvent.click(await screen.findByText('label.graph'));

    expect(screen.getByTestId('ontology-sparql-result-graph')).toBeVisible();
    expect(screen.getByTestId('query-result-g6')).toHaveAttribute(
      'data-edge-count',
      '1'
    );
    expect(screen.getByTestId('query-result-g6')).toHaveAttribute(
      'data-node-count',
      '2'
    );
  });

  it('creates a new query under My queries, then saves edits and a rename in place', async () => {
    renderConsole();

    fireEvent.click(screen.getByTestId('ontology-query-new'));

    await waitFor(() =>
      expect(mockReplaceSavedQueries).toHaveBeenLastCalledWith([
        expect.objectContaining({ name: 'label.untitled-query' }),
      ])
    );

    expect(screen.getByTestId('ontology-query-saved-list')).toHaveTextContent(
      'label.untitled-query'
    );
    expect(await screen.findByTestId('ontology-query-update')).toBeDisabled();

    fireEvent.change(screen.getByTestId('schema-editor'), {
      target: { value: 'SELECT ?concept WHERE { ?concept ?p ?o }' },
    });

    expect(screen.getByTestId('ontology-query-unsaved')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-query-update'));

    await waitFor(() =>
      expect(mockReplaceSavedQueries).toHaveBeenLastCalledWith([
        expect.objectContaining({
          name: 'label.untitled-query',
          query: 'SELECT ?concept WHERE { ?concept ?p ?o }',
        }),
      ])
    );

    fireEvent.click(screen.getByTestId('ontology-query-rename'));
    const renameInput = screen.getByTestId('ontology-query-rename-input');
    fireEvent.change(renameInput, { target: { value: 'My ontology query' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });

    await waitFor(() =>
      expect(mockReplaceSavedQueries).toHaveBeenLastCalledWith([
        expect.objectContaining({ name: 'My ontology query' }),
      ])
    );

    expect(await screen.findByTestId('ontology-query-title')).toHaveTextContent(
      'My ontology query'
    );
  });

  it('saves a copy of a query under My queries', async () => {
    renderConsole();

    fireEvent.change(screen.getByTestId('schema-editor'), {
      target: { value: 'SELECT ?concept WHERE { ?concept ?p ?o }' },
    });
    fireEvent.click(screen.getByTestId('ontology-query-save'));
    const input = await screen.findByTestId('ontology-query-save-name');

    expect(input).toHaveAttribute('placeholder', 'message.sparql-save-prompt');

    fireEvent.change(input, {
      target: { value: 'My ontology query' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    await waitFor(() => {
      expect(mockReplaceSavedQueries).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'My ontology query' }),
      ]);
    });

    expect(screen.getByTestId('ontology-query-saved-list')).toHaveTextContent(
      'My ontology query'
    );
  });

  it('allows an admin to edit and delete installation queries', async () => {
    mockUseAuth.mockReturnValue({
      isAdminUser: true,
      isFirstTimeUser: false,
    });
    mockGetSavedQueries.mockResolvedValue([]);
    mockGetQueryTemplates.mockResolvedValue([QUERY_TEMPLATE]);
    renderConsole();

    fireEvent.click(
      await screen.findByTestId(
        `ontology-query-template-edit-${QUERY_TEMPLATE.id}`
      )
    );
    fireEvent.change(screen.getByTestId('schema-editor'), {
      target: { value: 'SELECT ?custom WHERE { ?custom ?p ?o }' },
    });
    fireEvent.click(screen.getByTestId('ontology-query-save-template'));
    fireEvent.click(screen.getByRole('button', { name: 'label.update' }));

    await waitFor(() =>
      expect(mockReplaceQueryTemplates).toHaveBeenCalledWith([
        expect.objectContaining({
          id: QUERY_TEMPLATE.id,
          name: QUERY_TEMPLATE.name,
          query: 'SELECT ?custom WHERE { ?custom ?p ?o }',
        }),
      ])
    );

    fireEvent.click(
      screen.getByTestId(`ontology-query-template-delete-${QUERY_TEMPLATE.id}`)
    );

    await waitFor(() =>
      expect(mockReplaceQueryTemplates).toHaveBeenLastCalledWith([])
    );
  });
});

describe('native owner query library projection', () => {
  const seeds =
    require('../../../../../../../../openmetadata-service/src/main/resources/json/data/settings/sparqlQuerySettings.json')
      .queryTemplates as SavedSparqlQuery[];
  const renderNative = (createQueryOnMount = false) =>
    render(
      <OntologyStudioQueryConsole
        createQueryOnMount={createQueryOnMount}
        graphData={null}
        relationTypes={[]}
        selectedGlossaryIds={[]}
        selectedOntologyId="native"
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockUseAuth.mockReturnValue({ isAdminUser: true, isFirstTimeUser: false });
    mockGetSavedQueries.mockResolvedValue([]);
    mockGetQueryTemplates.mockResolvedValue(seeds);
    mockReplaceSavedQueries.mockImplementation(async (queries) => queries);
    mockReplaceQueryTemplates.mockImplementation(async (queries) => queries);
  });

  it('does not show the three loaded service seeds in a native owner', async () => {
    let resolveSaved!: (queries: SavedSparqlQuery[]) => void;
    let resolveTemplates!: (queries: SavedSparqlQuery[]) => void;
    mockGetSavedQueries.mockReturnValue(
      new Promise((resolve) => {
        resolveSaved = resolve;
      })
    );
    mockGetQueryTemplates.mockReturnValue(
      new Promise((resolve) => {
        resolveTemplates = resolve;
      })
    );
    renderNative();
    await act(async () => {
      resolveSaved([]);
      resolveTemplates(seeds);
    });
    for (const seed of seeds) {
      expect(
        screen.queryByTestId(`ontology-query-template-${seed.id}`)
      ).not.toBeInTheDocument();
    }
  });

  it('waits for both library reads before projecting native Shared queries', async () => {
    let resolveSaved!: (queries: SavedSparqlQuery[]) => void;
    let resolveTemplates!: (queries: SavedSparqlQuery[]) => void;
    mockGetSavedQueries.mockReturnValue(
      new Promise((resolve) => {
        resolveSaved = resolve;
      })
    );
    mockGetQueryTemplates.mockReturnValue(
      new Promise((resolve) => {
        resolveTemplates = resolve;
      })
    );
    renderNative();

    expect(screen.getByTestId('ontology-query-sample-rail')).toHaveAttribute(
      'data-library-state',
      'loading'
    );

    await act(async () => resolveSaved([]));

    expect(screen.getByTestId('ontology-query-sample-rail')).toHaveAttribute(
      'data-library-state',
      'loading'
    );

    await act(async () => resolveTemplates(seeds));
    await waitFor(() =>
      expect(screen.getByTestId('ontology-query-sample-rail')).toHaveAttribute(
        'data-library-state',
        'ready'
      )
    );
    for (const seed of seeds) {
      expect(
        screen.queryByTestId(`ontology-query-template-${seed.id}`)
      ).not.toBeInTheDocument();
    }
  });

  it('omits only exact canonical records after the library is ready', async () => {
    const changed = { ...seeds[0], name: 'My changed seed' };
    const custom = { ...seeds[0], id: 'custom-copy', name: 'My copy' };
    mockGetQueryTemplates.mockResolvedValue([
      ...seeds.slice(1),
      changed,
      custom,
    ]);
    renderNative();
    await waitFor(() =>
      expect(screen.getByTestId('ontology-query-sample-rail')).toHaveAttribute(
        'data-library-state',
        'ready'
      )
    );

    expect(screen.queryByText(seeds[1].name)).not.toBeInTheDocument();
    expect(screen.queryByText(seeds[2].name)).not.toBeInTheDocument();
    expect(screen.getByText('My changed seed')).toBeInTheDocument();
    expect(screen.getByText('My copy')).toBeInTheDocument();
  });

  it.each([
    ['id', 'authored-id'],
    ['name', 'Edited name'],
    ['query', 'SELECT * WHERE {}'],
    ['format', 'xml'],
    ['inference', 'owl'],
    ['savedAt', 1],
  ])('keeps a same-seed template when %s changes', async (field, value) => {
    const edited = { ...seeds[0], [field]: value };
    mockGetQueryTemplates.mockResolvedValue([edited, ...seeds.slice(1)]);
    renderNative();

    expect(
      await screen.findByTestId(`ontology-query-template-${edited.id}`)
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`ontology-query-template-${seeds[1].id}`)
    ).not.toBeInTheDocument();
  });

  it('keeps a personal copy of a canonical template', async () => {
    const personal = { ...seeds[0], id: 'personal-copy' };
    mockGetSavedQueries.mockResolvedValue([personal]);
    renderNative();

    expect(
      await screen.findByTestId('ontology-query-saved-personal-copy')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`ontology-query-template-${seeds[0].id}`)
    ).not.toBeInTheDocument();
  });

  it('preserves hidden canonical records when saving an authored template', async () => {
    const authored = { ...seeds[0], id: 'authored', name: 'Authored' };
    mockGetQueryTemplates.mockResolvedValue([...seeds, authored]);
    renderNative();
    fireEvent.click(
      await screen.findByTestId('ontology-query-template-edit-authored')
    );
    fireEvent.change(screen.getByTestId('schema-editor'), {
      target: { value: 'SELECT ?custom WHERE { ?custom ?p ?o }' },
    });
    fireEvent.click(screen.getByTestId('ontology-query-save-template'));
    fireEvent.click(screen.getByRole('button', { name: 'label.update' }));
    await waitFor(() =>
      expect(mockReplaceQueryTemplates).toHaveBeenCalledWith([
        ...seeds,
        expect.objectContaining({
          id: 'authored',
          query: 'SELECT ?custom WHERE { ?custom ?p ?o }',
        }),
      ])
    );
  });

  it('preserves hidden canonical records in authored template replacement writes', async () => {
    const authored = { ...seeds[0], id: 'authored', name: 'Authored' };
    mockGetQueryTemplates.mockResolvedValue([...seeds, authored]);
    renderNative();
    fireEvent.click(
      await screen.findByTestId('ontology-query-template-delete-authored')
    );
    await waitFor(() =>
      expect(mockReplaceQueryTemplates).toHaveBeenCalledWith(seeds)
    );
  });

  it('never auto-creates when either library read fails', async () => {
    mockGetQueryTemplates.mockRejectedValue(new Error('offline'));
    renderNative(true);
    await waitFor(() =>
      expect(screen.getByTestId('ontology-query-sample-rail')).toHaveAttribute(
        'data-library-state',
        'error'
      )
    );

    expect(mockReplaceSavedQueries).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'server.unexpected-error'
    );
    expect(
      screen.queryByText('message.no-query-available')
    ).not.toBeInTheDocument();
  });

  it('keeps canonical records in the legacy console', async () => {
    render(
      <OntologyStudioQueryConsole
        graphData={GRAPH_DATA}
        relationTypes={RELATION_TYPES}
        selectedGlossaryIds={['glossary-1']}
      />
    );

    expect(await screen.findByText(seeds[0].name)).toBeInTheDocument();
    expect(screen.getByText(seeds[1].name)).toBeInTheDocument();
    expect(screen.getByText(seeds[2].name)).toBeInTheDocument();
  });
});
