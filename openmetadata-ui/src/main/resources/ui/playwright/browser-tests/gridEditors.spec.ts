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
import { fillTextInputDetails } from '../utils/importUtils';

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
