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
import QueryViewer from './QueryViewer.component';

jest.mock('../../Database/SchemaEditor/SchemaEditor', () => {
  return jest
    .fn()
    .mockImplementation(({ value }) => (
      <div data-testid="schema-editor">{value}</div>
    ));
});

jest.mock('../../../hooks/useClipBoard', () => ({
  useClipboard: jest.fn().mockReturnValue({
    onCopyToClipBoard: jest.fn(),
  }),
}));

describe('QueryViewer Component', () => {
  it('should render with SQL query', () => {
    const sqlQuery = 'SELECT * FROM table';
    render(<QueryViewer sqlQuery={sqlQuery} title={<span>Test Title</span>} />);

    expect(screen.getByTestId('schema-editor')).toBeInTheDocument();
    expect(screen.getByTestId('schema-editor')).toHaveTextContent(sqlQuery);
    expect(screen.getByTestId('query-line')).toBeInTheDocument();
    expect(screen.getByTestId('query-entity-copy-button')).toBeInTheDocument();
  });

  it('should render title without SQL editor when query is empty', () => {
    render(<QueryViewer sqlQuery="" title={<span>dbt Project Info</span>} />);

    expect(screen.queryByTestId('schema-editor')).not.toBeInTheDocument();
    expect(screen.queryByTestId('query-line')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('query-entity-copy-button')
    ).not.toBeInTheDocument();
    expect(screen.getByText('dbt Project Info')).toBeInTheDocument();
  });

  it('should render title without SQL editor when query is undefined-like empty string', () => {
    render(
      <QueryViewer sqlQuery="" title={<span>Path: seeds/my_seed.csv</span>} />
    );

    expect(screen.queryByTestId('schema-editor')).not.toBeInTheDocument();
    expect(screen.getByText('Path: seeds/my_seed.csv')).toBeInTheDocument();
  });

  it('should show correct line count for multiline SQL', () => {
    const multilineSql = 'SELECT *\nFROM table\nWHERE id = 1';
    render(<QueryViewer sqlQuery={multilineSql} />);

    expect(screen.getByTestId('query-line')).toHaveTextContent('3');
  });
});
