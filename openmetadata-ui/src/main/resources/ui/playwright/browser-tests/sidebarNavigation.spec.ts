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
import { expect, Page, test } from '@playwright/test';
import { buildSync } from 'esbuild';
import { resolve } from 'path';
import { SidebarItem } from '../constant/sidebar';
import { sidebarClick } from '../utils/sidebar';

const bundle = buildSync({
  stdin: {
    contents: `import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
      import LeftSidebarItem from './src/components/MyData/LeftSidebar/LeftSidebarItem.component';
      function App() {
        const [governanceOpen, setGovernanceOpen] = useState(false);
        const location = useLocation();
        const navigate = useNavigate();
        const [glossaryRedirect] = useState(() => new URLSearchParams(location.search).get('glossaryRedirect'));
        return <>
          <aside data-testid="left-sidebar">
            <button data-testid="governance" type="button" onClick={() => setGovernanceOpen(true)}>Governance</button>
            {governanceOpen && (
              <LeftSidebarItem data={{key:'glossary',title:'Glossary',redirect_url:'/glossary',dataTestId:'app-bar-item-glossary',onClick:(event)=>{
                if (glossaryRedirect) {
                  event.preventDefault();
                  navigate(glossaryRedirect, { replace: true });
                }
              }}}/>
            )}
          </aside>
          <output data-testid="route">{location.pathname}</output>
        </>;
      }
      createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);`,
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

const mountSidebar = async (page: Page, params: Record<string, string>) => {
  await page.route('http://sidebar.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<div id="root"></div><img src="/slow-image" alt="">',
    })
  );
  // An unrelated image must not hold SPA navigation open until window.load.
  await page.route('http://sidebar.test/slow-image', () => undefined);
  await page.goto(
    `http://sidebar.test/my-data?${new URLSearchParams(params)}`,
    {
      waitUntil: 'domcontentloaded',
    }
  );
  await page.addScriptTag({ content: bundle });
};

test('sidebar navigation accepts a glossary redirect', async ({ page }) => {
  await mountSidebar(page, { glossaryRedirect: '/glossary/FirstGlossary' });

  await sidebarClick(page, SidebarItem.GLOSSARY);

  await expect(page.getByTestId('route')).toHaveText('/glossary/FirstGlossary');
});

test('sidebar navigation rejects a different route with the same prefix', async ({
  page,
}) => {
  await mountSidebar(page, { glossaryRedirect: '/glossary-unrelated' });

  const failure = await sidebarClick(page, SidebarItem.GLOSSARY).then(
    () => '',
    (error: Error) => error.message
  );
  expect(failure).toContain('Timeout');
  await expect(page.getByTestId('route')).toHaveText('/glossary-unrelated');
});
