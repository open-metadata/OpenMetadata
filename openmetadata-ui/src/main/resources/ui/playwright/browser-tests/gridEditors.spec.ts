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

import { expect, test } from '@playwright/test';
import { buildSync } from 'esbuild';
import { readFileSync } from 'fs';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { fillTableColumnInputDetails } from '../utils/customProperty';
import { fillTextInputDetails, fillTierDetails } from '../utils/importUtils';

const bundle = buildSync({
  stdin: {
    contents: `import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import DataGrid, { textEditor } from 'react-data-grid';
      const columns = [{ key: 'name', name: 'Name', editable: true, renderEditCell: textEditor }];
      function App() {
        const [rows, setRows] = useState([{ name: 'Original' }]);
        return <main className="ant-layout-content"><input aria-label="Unrelated search" defaultValue="Keep this query" />
          <DataGrid columns={columns} rows={rows} onRowsChange={setRows} style={{ height: 160 }} />
          <output data-testid="saved-cell">{rows[0].name}</output></main>;
      }
      createRoot(document.getElementById('root')).render(<App />);`,
    loader: 'tsx',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;

test('grid text editing targets the selected cell when another input has focus', async ({
  page,
}) => {
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({
    content: readFileSync(
      require.resolve('react-data-grid/lib/styles.css'),
      'utf8'
    ),
  });
  await page.addScriptTag({ content: bundle });
  await page.getByRole('gridcell', { name: 'Original', exact: true }).click();
  await page.getByRole('textbox', { name: 'Unrelated search' }).focus();
  await fillTextInputDetails(page, 'Updated');
  await expect(page.getByTestId('saved-cell')).toHaveText('Updated');
  await expect(
    page.getByRole('textbox', { name: 'Unrelated search' })
  ).toHaveValue('Keep this query');
});

const controllerBundle = buildSync({
  stdin: {
    contents: `import React, { useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import { LazyDataGrid as DataGrid } from './src/components/common/DataGrid/LazyDataGrid';
        import { lazyTextEditor } from './src/components/common/DataGrid/LazyDataGrid';
        import { useGridEditController } from './src/hooks/useGridEditController';
        const columns = [
          { key: 'name', name: 'Name', cellClass: 'rdg-cell-name', minWidth: 180, editable: true, renderEditCell: lazyTextEditor },
          { key: 'description', name: 'Description', cellClass: 'rdg-cell-description', minWidth: 180, editable: true, renderEditCell: lazyTextEditor },
        ];
        function App() {
          const [dataSource, setDataSource] = useState(document.getElementById('root').dataset.empty ? [] : [{ name: 'Original', description: 'Description' }]);
          const { setGridContainer, handleOnRowsChange, handleAddRow } = useGridEditController({ dataSource, setDataSource, columns });
          return <div data-testid="edit-table-type-property-modal"><button onClick={handleAddRow}>Add row</button><div ref={setGridContainer}>{dataSource.length > 0 && <DataGrid columns={columns} rows={dataSource}
            onRowsChange={handleOnRowsChange} style={{ height: 160 }} />}
            <output data-testid="saved-name">{dataSource[0]?.name}</output><output data-testid="saved-cell">{dataSource[0]?.description}</output></div></div>;
        }
        createRoot(document.getElementById('root')).render(<App />);`,
    loader: 'tsx',
    resolveDir: process.cwd(),
  },
  bundle: true,
  loader: { '.css': 'empty' },
  write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;

test('selecting another cell does not let a pending click close its editor', async ({
  page,
}) => {
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({
    content: readFileSync(
      require.resolve('react-data-grid/lib/styles.css'),
      'utf8'
    ),
  });
  await page.addScriptTag({ content: controllerBundle });
  await page.clock.install({ time: new Date('2026-09-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-01T00:01:00Z'));
  await page.getByRole('gridcell', { name: 'Original', exact: true }).click();
  await page
    .getByRole('gridcell', { name: 'Description', exact: true })
    .dblclick();
  await page.clock.runFor(50);
  const editor = page.getByRole('textbox');
  await expect(editor).toBeVisible();
  await editor.fill('Updated');
  await editor.press('Enter');
  await expect(page.getByTestId('saved-cell')).toHaveText('Updated');
});

test('editing consecutive grid cells preserves both values', async ({
  page,
}) => {
  await page.setContent('<div id="root" data-empty="true"></div>');
  await page.addStyleTag({
    content: readFileSync(
      require.resolve('react-data-grid/lib/styles.css'),
      'utf8'
    ),
  });
  await page.addScriptTag({ content: controllerBundle });
  await page.getByRole('button', { name: 'Add row', exact: true }).click();
  await fillTableColumnInputDetails(page, 'First value', 'name');
  await fillTableColumnInputDetails(page, 'Second value', 'description');
  await expect(page.getByTestId('saved-name')).toHaveText('First value');
  await expect(page.getByTestId('saved-cell')).toHaveText('Second value');
});

for (const selection of ['click', 'keyboard']) {
  test(`grid picker opens once after ${selection} selection`, async ({
    browser,
  }) => {
    const pickerBundle = buildSync({
      stdin: {
        contents: `import React, { useEffect, useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import { createPortal } from 'react-dom';
        import DataGrid from 'react-data-grid';
        function TierEditor({ row, onRowChange }) {
          const [ready, setReady] = useState(false);
          useEffect(() => { fetch('/api/v1/tags?parent=Tier').then(() => setReady(true)); }, []);
          return createPortal(<section role="dialog" aria-label="Edit tier">
            <button autoFocus>Cancel</button>
            {ready ? <><label data-testid="radio-btn-Tier1"><input type="radio" name="tier" />Tier1</label>
              <button data-testid="update-tier-card" onClick={() => onRowChange({ ...row, tier: 'Tier1' }, true)}>Save</button></>
              : <span role="status">Loading tiers</span>}
          </section>, document.body);
        }
        const columns = [{ key: 'tier', name: 'Tier', editable: true, renderEditCell: TierEditor }];
        function App() {
          const [rows, setRows] = useState([{ tier: 'Unassigned' }]);
          return <main className="ant-layout-content">
            <DataGrid columns={columns} rows={rows} onRowsChange={setRows}
              onCellClick={(args, event) => { args.selectCell(true); event.preventGridDefault(); }}
              style={{ height: 160 }} />
            <output data-testid="saved-tier">{rows[0].tier}</output></main>;
        }
        createRoot(document.getElementById('root')).render(<App />);`,
        loader: 'tsx',
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      define: { 'process.env.NODE_ENV': '"production"' },
    }).outputFiles[0].text;
    let requests = 0;
    const server = createServer((request, response) => {
      if (request.url?.startsWith('/api/v1/tags')) {
        requests++;
        setTimeout(() => {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end('{}');
        }, 300);
      } else {
        response.end('<div id="root"></div>');
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const baseURL = `http://127.0.0.1:${
      (server.address() as AddressInfo).port
    }`;
    const page = await browser.newPage({ baseURL });
    try {
      await page.goto(baseURL);
      await page.addStyleTag({
        content: readFileSync(
          require.resolve('react-data-grid/lib/styles.css'),
          'utf8'
        ),
      });
      await page.addScriptTag({ content: pickerBundle });
      if (selection === 'click') {
        await page
          .getByRole('gridcell', { name: 'Unassigned', exact: true })
          .click();
      } else {
        await expect(
          page.getByRole('gridcell', { name: 'Unassigned', exact: true })
        ).toBeVisible();
        await page.keyboard.press('Tab');
        await page.keyboard.press('ArrowDown');
        await expect(
          page.getByRole('gridcell', { name: 'Unassigned', exact: true })
        ).toHaveAttribute('aria-selected', 'true');
      }
      await fillTierDetails(page, 'Tier1', true);
      await expect(page.getByTestId('saved-tier')).toHaveText('Tier1');
      expect(requests).toBe(1);
    } finally {
      await page.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
}
