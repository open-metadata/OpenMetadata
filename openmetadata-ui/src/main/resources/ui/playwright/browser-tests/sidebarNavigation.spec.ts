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
import { SidebarItem } from '../constant/sidebar';
import { sidebarClick } from '../utils/sidebar';

const bundle = buildSync({
  stdin: {
    contents: `import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { BrowserRouter, useLocation } from 'react-router-dom';
      import { Layout, Menu } from 'antd';
      import LeftSidebarItem from './src/components/MyData/LeftSidebar/LeftSidebarItem.component';
      function App() {
        const [openKeys, setOpenKeys] = useState([]);
        const [opacityAtClick, setOpacityAtClick] = useState('');
        const location = useLocation();
        const collapsed = new URLSearchParams(location.search).get('collapsed') === 'true';
        return <>
          <Layout.Sider collapsed={collapsed} collapsedWidth={72} data-testid="left-sidebar">
            <Menu mode="inline" inlineCollapsed={collapsed} openKeys={openKeys} onOpenChange={setOpenKeys}
              items={[{key:'observability',icon:<span>O</span>,label:<span data-testid="observability">Observability</span>,children:[
                {key:'quality',label:'Data Quality'},
                {key:'alerts',label:<LeftSidebarItem data={{key:'alerts',title:'Alerts',redirect_url:'/observability/alerts',dataTestId:'app-bar-item-observability-alert',onClick:()=>{
                  const link = document.querySelector('[data-testid="app-bar-item-observability-alert"]');
                  const popup = link.closest('.ant-menu-submenu-popup');
                  setOpacityAtClick(popup ? getComputedStyle(popup).opacity : '1');
                }}}/>}
              ]}]}/>
          </Layout.Sider>
          <output data-testid="route">{location.pathname}</output>
          <output data-testid="click-opacity">{opacityAtClick}</output>
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

for (const collapsed of [true, false]) {
  test(`sidebar navigation waits for its submenu (collapsed=${collapsed})`, async ({
    page,
  }) => {
    await page.route('http://sidebar.test/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' })
    );
    await page.goto(`http://sidebar.test/my-data?collapsed=${collapsed}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.addStyleTag({ path: 'node_modules/antd/dist/antd.css' });
    // Keep the real zoom motion in its invisible, stable start phase longer.
    await page.addStyleTag({
      content:
        '.ant-zoom-big-appear, .ant-zoom-big-enter { animation-delay: 400ms !important; }',
    });
    await page.addScriptTag({ content: bundle });
    await sidebarClick(page, SidebarItem.OBSERVABILITY_ALERT);
    await expect(page.getByTestId('route')).toHaveText('/observability/alerts');
    await expect(page.getByTestId('click-opacity')).toHaveText('1');
  });
}
