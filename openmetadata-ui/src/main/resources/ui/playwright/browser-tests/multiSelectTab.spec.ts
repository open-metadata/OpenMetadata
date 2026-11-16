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

/**
 * Leaving a field that holds several values with Tab adds nothing. In a real browser React's
 * capture and bubble listeners run as separate callbacks, with microtasks between them, which is
 * what jsdom does not reproduce. ADR:2026-10-20-leaving-a-multi-select-with-tab-adds-nothing
 */

import { expect, Page, test } from '@playwright/test';
import { buildSync } from 'esbuild';
import { resolve } from 'path';

const bundle = buildSync({
  stdin: {
    contents: `import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { useListData } from 'react-aria-components';
      import { Autocomplete, MultiSelect } from '@openmetadata/ui-core-components';
      const OPTIONS = [{ id: 'pii', label: 'PII' }, { id: 'tier1', label: 'Tier 1' }];
      function Picked({ testId, onReady }) {
        const [picked, setPicked] = React.useState([]);
        onReady(id => setPicked(previous => [...previous, id]));
        return <output data-testid={testId}>{picked.join(',')}</output>;
      }
      function Field({ name, multiple }) {
        const add = React.useRef(() => undefined);
        return <div data-testid={name}>
          <Autocomplete items={OPTIONS} multiple={multiple} placeholder={name}
            selectedItems={[]} onItemInserted={id => add.current(id)}>
            {item => <Autocomplete.Item id={item.id} key={item.id}>{item.label}</Autocomplete.Item>}
          </Autocomplete>
          <Picked testId={name + '-picked'} onReady={next => { add.current = next; }} />
        </div>;
      }
      function Several() {
        const selected = useListData({ initialItems: [] });
        return <div data-testid="several">
          <MultiSelect items={OPTIONS} label="Several" placeholder="several" selectedItems={selected}>
            {item => <MultiSelect.Item id={item.id} textValue={item.label}>{item.label}</MultiSelect.Item>}
          </MultiSelect>
          <output data-testid="several-picked">{selected.items.map(item => item.id).join(',')}</output>
        </div>;
      }
      function App() {
        return <>
          <Field name="multiple" multiple />
          <Field name="single" multiple={false} />
          <Several />
          <button data-testid="after">After</button>
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
    // This checkout's build, which is what CI mounts there, whatever the link resolves to.
    '@openmetadata/ui-core-components': resolve(
      '../../../../../openmetadata-ui-core-components/src/main/resources/ui'
    ),
  },
  define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;

const open = async (page: Page) => {
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({
    path: 'node_modules/@openmetadata/ui-core-components/dist/ui-core-components.css',
  });
  await page.addScriptTag({ content: bundle });
};

const inputOf = (page: Page, name: string) =>
  page.getByTestId(name).getByRole('combobox');

test('Tab out of a multi-value field with an option highlighted adds nothing', async ({
  page,
}) => {
  await open(page);
  const input = inputOf(page, 'multiple');

  await input.click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');

  await expect(page.getByTestId('multiple-picked')).toBeEmpty();
  await expect(inputOf(page, 'single')).toBeFocused();
});

test('Tab after picking an option adds only that option', async ({ page }) => {
  await open(page);
  const input = inputOf(page, 'multiple');

  await input.click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');

  await expect(page.getByTestId('multiple-picked')).toHaveText('pii');
});

test('Tab out of a multi-select with an option highlighted adds nothing', async ({
  page,
}) => {
  await open(page);
  const input = inputOf(page, 'several');

  await input.click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');

  await expect(page.getByTestId('several-picked')).toBeEmpty();
  await expect(page.getByTestId('after')).toBeFocused();
});

// A field with one value keeps the combobox behaviour: Tab accepts the highlighted option.
test('Tab out of a single-value field takes the highlighted option', async ({
  page,
}) => {
  await open(page);
  const input = inputOf(page, 'single');

  await input.click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');

  await expect(page.getByTestId('single-picked')).toHaveText('pii');
});
