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
import { dirname } from 'path';

/**
 * Isolates the bulk-edit owner picker to the two pieces that matter.
 *
 * The real editor (CSVUtilsClassBase's owner column) renders
 * UserTeamSelectableList with `popoverProps={{ open: true }}`, so the
 * core-components Popover is open on its very first render and is anchored to a
 * triggerRef inside a react-data-grid cell editor. After main's #32252 migrated
 * that Popover from antd to react-aria, five bulk-edit specs started failing on
 * `select-owner-tabs` never appearing.
 *
 * The component's jsdom tests cannot cover this: the sibling suite stubs
 * Popover out entirely, and even with the real one jsdom has no layout, so
 * react-aria's geometry-dependent positioning never runs. This exercises the
 * same shape in a real browser with no backend.
 *
 * It passes, and that turned out to be the correct reading: the Popover was
 * never the fault. #32252 also deleted the Playwright helper
 * `clickActiveGridCell` while leaving its call in `openOwnerPickerEditor`, so
 * every retry threw a ReferenceError into that loop's empty catch and the cell
 * was never clicked at all. A DOM observer over the failing run showed the
 * picker opening the instant the cell is genuinely clicked.
 *
 * Keep this as the guard the jsdom test cannot be — the sibling suite stubs
 * Popover out, so nothing else would notice a real regression here. If it goes
 * red, the fault really is in the Popover.
 */
const bundle = buildSync({
  stdin: {
    contents: `import React, { useState, useRef, useLayoutEffect } from 'react';
      import { createRoot } from 'react-dom/client';
      import DataGrid from 'react-data-grid';
      import { Popover } from '@openmetadata/ui-core-components';

      // Mirrors UserTeamSelectableList: a trigger span carrying the ref, plus a
      // popover whose open state is forced true by the consumer. isMounted
      // reproduces the layout-effect gate the component added so that isOpen is
      // a false -> true transition after the ref is attached.
      function OwnerPicker({ onClose }) {
        const triggerRef = useRef(null);
        const [isMounted, setIsMounted] = useState(false);
        useLayoutEffect(() => { setIsMounted(true); }, []);
        const isOpen = isMounted && true;

        return (
          <>
            <span ref={triggerRef} data-testid="owner-trigger">cell value</span>
            <Popover
              isOpen={isOpen}
              triggerRef={triggerRef}
              placement="bottom end"
              onOpenChange={(open) => { if (!open) { onClose(); } }}>
              <div data-testid="select-owner-tabs">PICKER CONTENT</div>
            </Popover>
          </>
        );
      }

      const columns = [
        { key: 'name', name: 'Name', minWidth: 160 },
        { key: 'owner', name: 'Owner', minWidth: 200, editable: true, renderEditCell: OwnerPicker },
      ];

      function App() {
        const [rows, setRows] = useState([{ name: 'Row One', owner: '' }]);

        return (
          <main>
            <DataGrid columns={columns} rows={rows} onRowsChange={setRows} style={{ height: 200 }} />
          </main>
        );
      }
      createRoot(document.getElementById('root')).render(<App />);`,
    loader: 'tsx',
    resolveDir: process.cwd(),
  },
  bundle: true,
  loader: { '.css': 'empty' },
  write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  // ui-core-components is a yarn `link:`, so it resolves React from its own
  // node_modules. Two React copies in one bundle makes every hook read a null
  // dispatcher ("Cannot read properties of null (reading 'useContext')") and
  // nothing mounts at all.
  alias: {
    react: dirname(require.resolve('react/package.json')),
    'react-dom': dirname(require.resolve('react-dom/package.json')),
  },
}).outputFiles[0].text;

test('a popover forced open on mount renders inside a grid cell editor', async ({
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

  // Enter edit mode on the owner cell, which mounts the picker. ArrowRight,
  // not Tab: Tab moves focus out of the grid rather than across its cells.
  await page.getByRole('gridcell').filter({ hasText: 'Row One' }).click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('owner-trigger')).toBeVisible();
  await expect(page.getByTestId('select-owner-tabs')).toBeVisible();
});
