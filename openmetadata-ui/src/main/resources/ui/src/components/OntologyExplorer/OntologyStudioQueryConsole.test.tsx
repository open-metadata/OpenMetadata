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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Type } from '../../generated/api/rdf/sparqlResponse';
import { useAuth } from '../../hooks/authHooks';
import {
  getSavedSparqlQueries,
  getSparqlQueryTemplates,
  replaceSavedSparqlQueries,
  replaceSparqlQueryTemplates,
  runSparqlQuery,
  SavedSparqlQuery,
} from '../../rest/rdfAPI';
import { GlossaryTermRelationType } from '../../rest/settingConfigAPI';
import { OntologyGraphData } from './OntologyExplorer.interface';
import OntologyStudioQueryConsole from './OntologyStudioQueryConsole';

interface SchemaEditorMockProps {
  value: string;
  onChange?: (value: string) => void;
}

jest.mock('../Database/SchemaEditor/SchemaEditor', () => ({
  __esModule: true,
  default: ({ value, onChange }: SchemaEditorMockProps) => (
    <textarea
      data-testid="schema-editor"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

jest.mock('../../rest/rdfAPI', () => ({
  getSavedSparqlQueries: jest.fn(),
  getSparqlQueryTemplates: jest.fn(),
  replaceSavedSparqlQueries: jest.fn(),
  replaceSparqlQueryTemplates: jest.fn(),
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

const RELATION_TYPES: GlossaryTermRelationType[] = [
  {
    name: 'relatedTo',
    displayName: 'Related To',
    rdfPredicate: 'https://open-metadata.org/ontology/relatedTo',
    category: 'associative',
  },
];

function renderConsole() {
  return render(
    <OntologyStudioQueryConsole
      graphData={GRAPH_DATA}
      relationTypes={RELATION_TYPES}
      selectedGlossaryIds={[]}
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
  });

  it('derives the compact Studio query rail from the ontology graph', () => {
    renderConsole();

    expect(screen.getByTestId('ontology-query-sample-rail')).toHaveClass(
      'tw:w-60'
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
  });

  it('loads and runs an ontology-derived query from the rail', async () => {
    renderConsole();

    fireEvent.click(
      screen.getByTestId('ontology-query-suggestion-ontology-relatedTo-target')
    );

    await waitFor(() =>
      expect(mockRunSparqlQuery).toHaveBeenCalledWith(
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

  it('creates and persists a private user-authored query', async () => {
    renderConsole();

    fireEvent.click(screen.getByTestId('ontology-query-new'));
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
