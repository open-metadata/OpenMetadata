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
import { SparqlPlaygroundResult } from '../../rest/rdfAPI';
import { downloadCsv } from '../../utils/Export/ExportUtils';
import OntologyQueryResults from './OntologyQueryResults';

jest.mock('./OntologyGraphG6', () => ({
  __esModule: true,
  default: () => <div data-testid="query-result-g6" />,
}));

jest.mock('../../utils/Export/ExportUtils', () => ({
  downloadCsv: jest.fn(),
}));

const writeText = jest.fn().mockResolvedValue(undefined);

const selectResult = (
  bindings: Array<Record<string, { type: Type; value: string }>>
): SparqlPlaygroundResult => ({
  format: 'json',
  body: '',
  contentType: 'application/sparql-results+json',
  durationMs: 38,
  parsed: { head: { vars: ['c', 'label'] }, results: { bindings } },
});

const THREE_ROWS = selectResult([
  {
    c: { type: Type.URI, value: 'urn:a' },
    label: { type: Type.Literal, value: 'Alpha' },
  },
  {
    c: { type: Type.URI, value: 'urn:b' },
    label: { type: Type.Literal, value: 'Beta, the second' },
  },
  {
    c: { type: Type.URI, value: 'urn:c' },
    label: { type: Type.Literal, value: 'Gamma' },
  },
]);

function renderResults(
  result: SparqlPlaygroundResult,
  props: { scopeLabel?: string; exportName?: string } = {}
) {
  return render(
    <OntologyQueryResults
      graphData={null}
      relationshipTypes={[]}
      result={result}
      {...props}
    />
  );
}

describe('OntologyQueryResults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
  });

  it('states the row count, the run time and the scope the query ran against', () => {
    renderResults(THREE_ROWS, { scopeLabel: 'clinical · v1.0.0' });

    expect(
      screen.getByTestId('ontology-sparql-result-status')
    ).toHaveTextContent(/^3 label\.row-plural\s*·\s*38 ms$/);
    expect(
      screen.getByTestId('ontology-sparql-result-scope')
    ).toHaveTextContent('clinical · v1.0.0');
  });

  it('names the working draft as the scope when the query ran on it', () => {
    renderResults(THREE_ROWS, { scopeLabel: 'clinical · draft' });

    expect(
      screen.getByTestId('ontology-sparql-result-scope')
    ).toHaveTextContent('clinical · draft');
  });

  it('uses the singular for one row', () => {
    renderResults(
      selectResult([
        {
          c: { type: Type.URI, value: 'urn:a' },
          label: { type: Type.Literal, value: 'A' },
        },
      ])
    );

    expect(
      screen.getByTestId('ontology-sparql-result-status')
    ).toHaveTextContent(/^1 label\.row\s*·/);
  });

  it('copies the table as tab-separated text', async () => {
    renderResults(THREE_ROWS);

    fireEvent.click(screen.getByTestId('ontology-sparql-copy'));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'c\tlabel\nurn:a\tAlpha\nurn:b\tBeta, the second\nurn:c\tGamma'
      )
    );

    expect(await screen.findByTestId('ontology-sparql-copy')).toHaveTextContent(
      'label.copied'
    );
  });

  it('downloads the table as CSV named after the query', () => {
    renderResults(THREE_ROWS, { exportName: 'All concepts' });

    fireEvent.click(screen.getByTestId('ontology-sparql-csv'));

    expect(downloadCsv).toHaveBeenCalledWith(
      'c,label\nurn:a,Alpha\nurn:b,"Beta, the second"\nurn:c,Gamma',
      'All-concepts.csv'
    );
  });

  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('shows the answer to an ASK query that is %s', (answer, text) => {
    renderResults({
      format: 'json',
      body: '',
      contentType: 'application/sparql-results+json',
      durationMs: 5,
      parsed: { head: {}, boolean: answer },
    });

    expect(screen.getByTestId('ontology-sparql-ask')).toHaveTextContent(
      new RegExp(`^${text}$`)
    );
    expect(
      screen.getByTestId('ontology-sparql-result-status')
    ).toHaveTextContent(/5 ms/);
    expect(
      screen.queryByTestId('ontology-sparql-result-table')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('ontology-sparql-csv')).not.toBeInTheDocument();
  });

  it('copies the answer of an ASK query', async () => {
    renderResults({
      format: 'json',
      body: '',
      contentType: 'application/sparql-results+json',
      durationMs: 5,
      parsed: { head: {}, boolean: true },
    });

    fireEvent.click(screen.getByTestId('ontology-sparql-copy'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('true'));
  });

  it('shows a CONSTRUCT graph as its Turtle text and copies it without offering CSV', async () => {
    const turtle = '<urn:a> <urn:p> "x" .';
    renderResults({
      format: 'turtle',
      body: turtle,
      contentType: 'text/turtle',
      durationMs: 9,
    });

    expect(screen.getByTestId('ontology-sparql-graph-text')).toHaveTextContent(
      turtle
    );
    expect(screen.queryByTestId('ontology-sparql-csv')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-sparql-copy'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(turtle));
  });

  it('says so when a SELECT matches nothing and still offers the header as CSV', () => {
    renderResults(selectResult([]));

    expect(screen.getByTestId('ontology-sparql-no-rows')).toBeInTheDocument();
    expect(
      screen.getByTestId('ontology-sparql-result-status')
    ).toHaveTextContent(/^0 label\.row-plural/);
  });
});
