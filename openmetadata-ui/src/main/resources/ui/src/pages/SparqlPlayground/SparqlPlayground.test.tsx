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
import React from 'react';
import { Type } from '../../generated/api/rdf/sparqlResponse';
import {
  getSavedSparqlQueries,
  getSparqlQueryTemplates,
  replaceSavedSparqlQueries,
  runSparqlQuery,
  SavedSparqlQuery,
} from '../../rest/rdfAPI';
import SparqlPlayground from './SparqlPlayground.component';

jest.mock('../../rest/rdfAPI', () => ({
  getSavedSparqlQueries: jest.fn(),
  getSparqlQueryTemplates: jest.fn(),
  replaceSavedSparqlQueries: jest.fn(),
  replaceSparqlQueryTemplates: jest.fn(),
  runSparqlQuery: jest.fn(),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: false }),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  const Mock: React.FC<React.PropsWithChildren> = ({ children }) => (
    <div data-testid="page-layout">{children}</div>
  );

  return Mock;
});

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    const Mock: React.FC = () => <div data-testid="breadcrumb" />;

    return Mock;
  }
);

jest.mock('../../components/Database/SchemaEditor/SchemaEditor', () => {
  const Mock: React.FC<{
    value?: string;
    onChange?: (v: string) => void;
  }> = ({ value, onChange }) => (
    <textarea
      data-testid="schema-editor"
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );

  return Mock;
});

const mockRun = runSparqlQuery as jest.MockedFunction<typeof runSparqlQuery>;
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

const QUERY_TEMPLATE: SavedSparqlQuery = {
  id: '692cb99a-96fd-4f47-8f28-3d7e471ff001',
  name: 'Installation glossary query',
  query: 'SELECT ?term WHERE { ?term a <urn:GlossaryTerm> }',
  format: 'json',
  inference: 'none',
  savedAt: 0,
};

describe('SparqlPlayground', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockRun.mockReset();
    mockGetSavedQueries.mockReturnValue(
      new Promise<SavedSparqlQuery[]>(() => undefined)
    );
    mockGetQueryTemplates.mockReturnValue(
      new Promise<SavedSparqlQuery[]>(() => undefined)
    );
    mockReplaceSavedQueries.mockImplementation(async (queries) => queries);
  });

  it('renders the heading and the editor', () => {
    render(<SparqlPlayground />);

    expect(screen.getByTestId('heading')).toHaveTextContent(
      'label.sparql-playground'
    );
    expect(screen.getByTestId('schema-editor')).toBeInTheDocument();
    expect(screen.getByTestId('sparql-run')).toBeInTheDocument();
  });

  it('imports and removes the legacy shared saved-query cache after persistence', async () => {
    window.localStorage.setItem(
      'om.sparql-playground.savedQueries',
      JSON.stringify([QUERY_TEMPLATE])
    );
    mockGetSavedQueries.mockResolvedValue([]);
    mockGetQueryTemplates.mockResolvedValue([]);

    render(<SparqlPlayground />);

    await waitFor(() => {
      expect(mockReplaceSavedQueries).toHaveBeenCalledWith([QUERY_TEMPLATE]);
      expect(
        window.localStorage.getItem('om.sparql-playground.savedQueries')
      ).toBeNull();
    });
  });

  it('retains the legacy cache when server persistence fails', async () => {
    const serializedQuery = JSON.stringify([QUERY_TEMPLATE]);
    window.localStorage.setItem(
      'om.sparql-playground.savedQueries',
      serializedQuery
    );
    mockGetSavedQueries.mockResolvedValue([]);
    mockGetQueryTemplates.mockResolvedValue([]);
    mockReplaceSavedQueries.mockRejectedValue(new Error('persistence failed'));

    render(<SparqlPlayground />);

    await waitFor(() => {
      expect(mockReplaceSavedQueries).toHaveBeenCalled();
      expect(
        window.localStorage.getItem('om.sparql-playground.savedQueries')
      ).toBe(serializedQuery);
    });
  });

  it('shows an error and skips the API call when the editor body is empty', async () => {
    render(<SparqlPlayground />);
    const editor = screen.getByTestId('schema-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('sparql-run'));
    await waitFor(() => {
      expect(screen.getByTestId('sparql-error')).toBeInTheDocument();
    });

    expect(mockRun).not.toHaveBeenCalled();
  });

  it('calls runSparqlQuery and renders a JSON tabular result', async () => {
    mockRun.mockResolvedValueOnce({
      format: 'json',
      contentType: 'application/sparql-results+json',
      body: '{}',
      durationMs: 17,
      parsed: {
        head: { vars: ['s', 'p', 'o'] },
        results: {
          bindings: [
            {
              s: { type: Type.URI, value: 'urn:s' },
              p: { type: Type.URI, value: 'urn:p' },
              o: { type: Type.Literal, value: 'hello' },
            },
          ],
        },
      },
    });

    render(<SparqlPlayground />);
    fireEvent.click(screen.getByTestId('sparql-run'));

    await waitFor(() => {
      expect(screen.getByTestId('sparql-table')).toBeInTheDocument();
    });

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('renders the raw body for non-JSON formats', async () => {
    mockRun.mockResolvedValueOnce({
      format: 'turtle',
      contentType: 'text/turtle',
      body: '<urn:s> <urn:p> <urn:o> .',
      durationMs: 5,
    });

    render(<SparqlPlayground />);
    fireEvent.click(screen.getByTestId('sparql-run'));

    await waitFor(() => {
      expect(screen.getByTestId('sparql-raw')).toBeInTheDocument();
    });

    expect(screen.getByTestId('sparql-raw').textContent).toContain('<urn:s>');
  });

  it('surfaces a server error message when the API rejects the query', async () => {
    mockRun.mockRejectedValueOnce(new Error('SERVICE clause forbidden'));

    render(<SparqlPlayground />);
    fireEvent.click(screen.getByTestId('sparql-run'));

    await waitFor(() => {
      expect(screen.getByTestId('sparql-error')).toHaveTextContent(
        'SERVICE clause forbidden'
      );
    });
  });

  it('persists a private saved query through the current-user API', async () => {
    render(<SparqlPlayground />);
    fireEvent.click(screen.getByTestId('sparql-save-query'));

    const input = await screen.findByTestId('sparql-save-name-input');

    expect(input).toHaveAttribute('placeholder', 'message.sparql-save-prompt');

    fireEvent.change(input, { target: { value: 'My query' } });
    fireEvent.click(screen.getByText('label.save'));

    await waitFor(() => {
      expect(mockReplaceSavedQueries).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'My query' }),
      ]);
    });

    expect(screen.getByTestId('sparql-saved-list')).toHaveTextContent(
      'My query'
    );
  });

  it('loads an administrator-managed installation query', async () => {
    mockGetSavedQueries.mockResolvedValue([]);
    mockGetQueryTemplates.mockResolvedValue([QUERY_TEMPLATE]);
    render(<SparqlPlayground />);
    fireEvent.click(
      await screen.findByTestId(`sparql-template-${QUERY_TEMPLATE.id}`)
    );
    const editor = screen.getByTestId('schema-editor') as HTMLTextAreaElement;

    expect(editor.value).toBe(QUERY_TEMPLATE.query);
  });

  it('inject prefixes adds the canonical PREFIX block when missing', () => {
    render(<SparqlPlayground />);
    const editor = screen.getByTestId('schema-editor') as HTMLTextAreaElement;
    act(() => {
      fireEvent.change(editor, {
        target: { value: 'SELECT * WHERE { ?s ?p ?o }' },
      });
    });
    fireEvent.click(screen.getByTestId('sparql-inject-prefixes'));

    expect(editor.value).toContain('PREFIX om:');
  });
});
