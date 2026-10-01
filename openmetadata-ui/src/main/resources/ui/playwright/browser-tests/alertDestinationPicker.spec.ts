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
import { selectComboBoxOption } from '../utils/destination';

const bundle = buildSync({
  stdin: {
    contents: `import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { FormProvider, useForm, useWatch } from 'react-hook-form';
      import { Select } from '@openmetadata/ui-core-components';
      import i18n from 'i18next';
      import { initReactI18next } from 'react-i18next';
      import TeamAndUserSelectItem from './src/components/Alerts/DestinationFormItem/TeamAndUserSelectItem/TeamAndUserSelectItem';
      i18n.use(initReactI18next).init({lng:'en',resources:{en:{translation:{label:{'search-by-type':'Search by {{type}}','please-select-entity':'Select {{entity}}'}}}}});
      const search = async value => {
        const response = await fetch('/teams?q=' + encodeURIComponent(value));
        return response.json();
      };
      function App() {
        const [category, setCategory] = useState('Owners');
        const form = useForm({defaultValues:{destinations:[{config:{receivers:[]}}]}});
        const selected = useWatch({control:form.control,name:'destinations.0.config.receivers'});
        return <FormProvider {...form}>
          <div data-testid="scrolling-form" style={{height:400,overflow:'auto',marginTop:100,padding:16,width:500}}>
            <div style={{height:900}}>Alert filters</div>
            <Select.ComboBox data-testid="category" aria-label="Destination" selectedKey={category} onSelectionChange={setCategory} items={[{id:'Owners',label:'Owners'},{id:'Teams',label:'Teams'}]}>
              {item => <Select.Item id={item.id}>{item.label}</Select.Item>}
            </Select.ComboBox>
            {category === 'Teams' && <TeamAndUserSelectItem entityType="team" destinationNumber={0} fieldName={[0,'config','receivers']} onSearch={search} />}
            <div style={{height:180}}>Remaining destinations</div>
          </div>
          <output data-testid="selected">{JSON.stringify(selected)}</output>
          <button type="button" style={{position:'fixed',top:0,right:0}}>Outside</button>
        </FormProvider>;
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

test('a team picker stays open when focused in a scrolling alert form', async ({
  page,
}) => {
  await page.route('http://alert-picker.test/', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' })
  );
  await page.route('http://alert-picker.test/teams?*', (route) =>
    route.fulfill({ json: [{ label: 'Organization', value: 'Organization' }] })
  );
  await page.goto('http://alert-picker.test/', {
    waitUntil: 'domcontentloaded',
  });
  await page.addStyleTag({
    path: 'node_modules/@openmetadata/ui-core-components/dist/ui-core-components.css',
  });
  await page.addScriptTag({ content: bundle });
  await selectComboBoxOption({ page, testId: 'category', optionName: 'Teams' });
  const trigger = page.getByTestId('team-user-select-trigger-0');
  await trigger.focus();
  const scrollTop = await page
    .getByTestId('scrolling-form')
    .evaluate((element) => element.scrollTop);
  await trigger.click();
  const search = page.getByTestId('search-input-field');
  await expect(search).toBeFocused();
  await search.fill('Organization');
  expect(
    await page
      .getByTestId('scrolling-form')
      .evaluate((element) => element.scrollTop)
  ).toBe(scrollTop);
  await page.getByTestId('Organization-option-label').click();
  await expect(page.getByTestId('selected')).toHaveText('["Organization"]');
  await page.getByRole('button', { name: 'Outside', exact: true }).click();
  await expect(search).toBeHidden();
});
