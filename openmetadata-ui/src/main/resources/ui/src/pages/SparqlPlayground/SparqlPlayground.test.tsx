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
import { runSparqlQuery } from '../../rest/rdfAPI';
import SparqlPlayground from './SparqlPlayground.component';
import {
  SAMPLE_SPARQL_QUERIES,
  SPARQL_PLAYGROUND_STORAGE_KEY,
} from './SparqlPlayground.interface';

jest.mock('../../rest/rdfAPI', () => ({
  runSparqlQuery: jest.fn(),
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

describe('SparqlPlayground', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRun.mockReset();
  });

  it('renders the heading and the editor', () => {
    render(<SparqlPlayground />);

    expect(screen.getByTestId('heading')).toHaveTextContent(
      'label.sparql-playground'
    );
    expect(screen.getByTestId('schema-editor')).toBeInTheDocument();
    expect(screen.getByTestId('sparql-run')).toBeInTheDocument();
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
              s: { type: 'uri', value: 'urn:s' },
              p: { type: 'uri', value: 'urn:p' },
              o: { type: 'literal', value: 'hello' },
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

  it('persists a saved query to localStorage and lets you reload it', async () => {
    render(<SparqlPlayground />);
    fireEvent.click(screen.getByTestId('sparql-save-query'));

    const input = await screen.findByTestId('sparql-save-name-input');
    fireEvent.change(input, { target: { value: 'My query' } });
    fireEvent.click(screen.getByText('label.save'));

    await waitFor(() => {
      const stored = window.localStorage.getItem(SPARQL_PLAYGROUND_STORAGE_KEY);

      expect(stored).not.toBeNull();
      expect(stored).toContain('My query');
    });
  });

  it('loads a sample query into the editor', () => {
    render(<SparqlPlayground />);
    const sample = SAMPLE_SPARQL_QUERIES[0];
    fireEvent.click(screen.getByTestId(`sparql-sample-${sample.nameKey}`));
    const editor = screen.getByTestId('schema-editor') as HTMLTextAreaElement;

    expect(editor.value).toContain(sample.query.split('\n')[0]);
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
