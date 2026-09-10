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
import { resolve } from 'path';
import { selectOption } from '../utils/advancedSearch';

const bundle = buildSync({
  stdin: {
    contents: `import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import OMFieldSelect from './src/utils/queryBuilderWidgets/OMFieldSelect';
      function App() {
        const [group, setGroup] = useState(true);
        const [field, setField] = useState();
        return <><div data-testid="rule" className={group ? 'group--field' : 'rule--field'}>
          <OMFieldSelect key={String(group)}
            items={group ? [{key:'extension', label:'Custom Properties'}] : [{key:'extension.count', label:'Count'}]}
            selectedKey={field} setField={key => group ? setGroup(false) : setField(key)} />
        </div><output data-testid="selected-field">{field}</output></>;
      }
      createRoot(document.getElementById('root')).render(<App />);`,
    loader: 'tsx',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  jsx: 'automatic',
  alias: {
    react: resolve('node_modules/react'),
    'react-dom': resolve('node_modules/react-dom'),
  },
  define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;

test('query builder selection can replace a group control with its child field', async ({
  page,
}) => {
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({
    path: 'node_modules/@openmetadata/ui-core-components/dist/ui-core-components.css',
  });
  await page.addScriptTag({ content: bundle });
  await selectOption(
    page,
    page.locator('.group--field'),
    'Custom Properties',
    true
  );
  await selectOption(page, page.locator('.rule--field'), 'Count', true);
  await expect(page.getByTestId('selected-field')).toHaveText(
    'extension.count'
  );
});
