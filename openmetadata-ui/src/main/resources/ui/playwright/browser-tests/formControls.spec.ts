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
import { chooseSelectOption } from '../utils/common';
import { openMatchingFieldsPanel } from '../utils/searchSettingUtils';

const bundle = buildSync({
  stdin: {
    contents: `import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import Collapse from 'rc-collapse';
      import { Select, PaginationCardWithControls } from '@openmetadata/ui-core-components';
      function App() {
        const [strategy, setStrategy] = useState('COUNT');
        const [pageSize, setPageSize] = useState(25);
        return <>
          <Collapse accordion prefixCls="ant-collapse" defaultActiveKey="ranking">
            <Collapse.Panel header="Ranking Details" key="ranking">Ranking configuration</Collapse.Panel>
            <Collapse.Panel key="fields" header={<span><span>Matching Fields</span> <button type="button" onClick={e => e.stopPropagation()}>Add</button></span>}>
              <div data-testid="field-configurations">Field configuration</div>
            </Collapse.Panel>
          </Collapse>
          <Select id="testCaseFormV1_params_strategy" aria-label="Strategy" selectedKey={strategy} onSelectionChange={setStrategy}>
            <Select.Item id="COUNT">COUNT</Select.Item>
            <Select.Item id="ROWS">ROWS</Select.Item>
          </Select>
          <output data-testid="strategy">{strategy}</output>
          <div style={{height:200, width:600, overflow:'auto'}} data-testid="scrolling-table">
            <input aria-label="Filter rows" />
            <div style={{height:1200}}>Table rows</div>
            <PaginationCardWithControls page={1} total={1000} pageSize={pageSize} onPageChange={() => {}} onPageSizeChange={setPageSize}/>
          </div>
          <output data-testid="selected-page-size">{pageSize}</output>
        </>;
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

test.beforeEach(async ({ page }) => {
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({ path: 'node_modules/antd/dist/antd.css' });
  await page.addStyleTag({
    path: 'node_modules/@openmetadata/ui-core-components/dist/ui-core-components.css',
  });
  await page.addScriptTag({ content: bundle });
});

test('matching fields opens when its accessible name also contains an Add button', async ({
  page,
}) => {
  await openMatchingFieldsPanel(page);
  await expect(page.getByTestId('field-configurations')).toBeVisible();
});

test('SQL strategy selection updates the form value', async ({ page }) => {
  const strategy = page.locator('#testCaseFormV1_params_strategy');
  await chooseSelectOption(
    strategy,
    page.getByRole('listbox').getByRole('option', { name: 'ROWS', exact: true })
  );
  await expect(strategy).toHaveText('ROWS');
  await expect(page.getByTestId('strategy')).toHaveText('ROWS');
});

test('page-size selection in a scrolling table commits the intended option', async ({
  page,
}) => {
  await page.getByRole('textbox', { name: 'Filter rows' }).focus();
  const trigger = page.getByRole('button', { name: /Records$/ });
  await chooseSelectOption(
    trigger,
    page.getByTestId('rows-per-page-option-50')
  );
  await expect(trigger).toHaveText('50');
  await expect(page.getByTestId('selected-page-size')).toHaveText('50');
  await expect(page.getByRole('listbox')).toBeHidden();
});
