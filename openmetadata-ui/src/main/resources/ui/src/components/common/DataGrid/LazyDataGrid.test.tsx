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
import { render, screen } from '@testing-library/react';
import { LazyDataGrid } from './LazyDataGrid';

type Row = { id: string; name: string };

const columns = [
  { key: 'name', name: 'Name' },
  { key: 'id', name: 'Id' },
];
const rows: Row[] = [
  { id: '0', name: 'alpha' },
  { id: '1', name: 'beta' },
];

describe('LazyDataGrid rowTestId', () => {
  it('puts the mapped test id on the row element so a row can be addressed by identity', async () => {
    render(
      <LazyDataGrid
        columns={columns}
        rowTestId={(row) => `rdg-row-${row.id}`}
        rows={rows}
      />
    );

    expect(await screen.findByTestId('rdg-row-0')).toBeInTheDocument();
    expect(await screen.findByTestId('rdg-row-1')).toBeInTheDocument();
  });

  it('leaves a row unmarked when the mapper returns undefined', async () => {
    render(
      <LazyDataGrid columns={columns} rowTestId={() => undefined} rows={rows} />
    );

    expect(await screen.findByRole('grid')).toBeInTheDocument();
    expect(screen.queryByTestId('rdg-row-0')).not.toBeInTheDocument();
  });

  it('renders unchanged when no mapper is supplied', async () => {
    render(<LazyDataGrid columns={columns} rows={rows} />);

    expect(await screen.findByRole('grid')).toBeInTheDocument();
    expect(screen.queryByTestId('rdg-row-0')).not.toBeInTheDocument();
  });
});
