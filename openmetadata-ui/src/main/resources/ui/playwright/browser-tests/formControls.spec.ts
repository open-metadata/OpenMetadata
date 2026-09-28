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
import { removeTier } from '../utils/entity';
import { confirmPortRemoval } from '../utils/inputOutputPorts';
import { openMatchingFieldsPanel } from '../utils/searchSettingUtils';

const bundle = buildSync({
  stdin: {
    contents: `import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import Collapse from 'rc-collapse';
      import { Button, Popover, Typography } from 'antd';
      import { Select, PaginationCardWithControls } from '@openmetadata/ui-core-components';
      import ConfirmationModal from './src/components/Modals/ConfirmationModal/ConfirmationModal';
      function App() {
        const [strategy, setStrategy] = useState('COUNT');
        const [pageSize, setPageSize] = useState(25);
        const [tier, setTier] = useState('Tier4');
        const [tierOpen, setTierOpen] = useState(false);
        const [tierClickOpacity, setTierClickOpacity] = useState('');
        const [removeOpen, setRemoveOpen] = useState(false);
        const [portPresent, setPortPresent] = useState(true);
        const [removeClickOpacity, setRemoveClickOpacity] = useState('');
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
          <output data-testid="Tier">{tier}</output>
          <output data-testid="tier-click-opacity">{tierClickOpacity}</output>
          <Popover open={tierOpen} onOpenChange={setTierOpen} trigger="click" overlayClassName="tier-card-popover"
            content={<Typography.Text data-testid="clear-tier" tabIndex={0} onClick={async (event) => {
              setTierClickOpacity(getComputedStyle(event.currentTarget.closest('.ant-popover')).opacity);
              const response = await fetch('/api/v1/tables/fixture', { method: 'PATCH' });
              if (response.ok) { setTier('--'); setTierOpen(false); }
            }}>Clear</Typography.Text>}>
            <Button data-testid="edit-tier">Edit Tier</Button>
          </Popover>
          {portPresent && <Button onClick={() => setRemoveOpen(true)}>Remove output port</Button>}
          <output data-testid="remove-click-opacity">{removeClickOpacity}</output>
          <ConfirmationModal visible={removeOpen} header="Remove Port" bodyText="Remove the selected output port?"
            confirmText="Remove" cancelText="Cancel" onCancel={() => setRemoveOpen(false)}
            onConfirm={async () => {
              setRemoveClickOpacity(getComputedStyle(document.querySelector('.ant-modal')).opacity);
              const response = await fetch('/api/v1/dataProducts/fixture/outputPorts/remove', {method:'PUT'});
              if (response.ok) { setPortPresent(false); setRemoveOpen(false); }
            }} />
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

test('port removal waits for the confirmation dialog to finish opening', async ({
  page,
}) => {
  let removals = 0;
  await page.route(
    'http://forms.test/api/v1/dataProducts/fixture/outputPorts/remove',
    async (route) => {
      removals++;
      await route.fulfill({ json: {} });
    }
  );
  await page.addStyleTag({
    content:
      '.ant-zoom-appear, .ant-zoom-enter { animation-delay: 400ms !important; }',
  });
  await page.getByRole('button', { name: 'Remove output port' }).click();
  await confirmPortRemoval(page, 'fixture', 'output');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Remove output port' })
  ).toBeHidden();
  await expect(page.getByTestId('remove-click-opacity')).toHaveText('1');
  expect(removals).toBe(1);
});

test.beforeEach(async ({ page }) => {
  await page.route('http://forms.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<div id="root"></div>',
    })
  );
  await page.goto('http://forms.test/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ path: 'node_modules/antd/dist/antd.css' });
  await page.addStyleTag({
    path: 'node_modules/@openmetadata/ui-core-components/dist/ui-core-components.css',
  });
  await page.addScriptTag({ content: bundle });
});

test('clearing a tier waits for the popover zoom motion', async ({ page }) => {
  await page.route('http://forms.test/api/v1/tables/fixture', (route) =>
    route.fulfill({ json: {} })
  );
  await page.addStyleTag({
    content:
      '.ant-zoom-big-appear, .ant-zoom-big-enter { animation-delay: 400ms !important; }',
  });

  await removeTier(page, 'tables');

  await expect(page.getByTestId('Tier')).toHaveText('--');
  await expect(page.getByTestId('tier-click-opacity')).toHaveText('1');
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
