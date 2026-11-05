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
import {
  verifyWidgetCountOnCurrentPage,
  waitForLandingPageWidget,
} from '../utils/customizeLandingPage';

const widgetKey = 'KnowledgePanel.DataProducts';
const bundle = buildSync({
  stdin: {
    contents: `import React, { useEffect, useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import DeferredWidget from './src/components/common/DeferredWidget/DeferredWidget.component';
      const root = createRoot(document.getElementById('root'));
      window.mountLayout = () => window.setTimeout(() => root.render(<>
        <div style={{height: 2000}} />
        <DeferredWidget minHeight={200} data-testid="deferred-widget-${widgetKey}-211">
          <section data-testid="${widgetKey}"><output data-testid="asset-count">3</output></section>
        </DeferredWidget>
      </>), 250);
      const LateWidget = () => {
        const [painted, setPainted] = useState(false);
        useEffect(() => {
          const timer = window.setTimeout(() => {
            window.lateWidgetPainted = true;
            setPainted(true);
          }, 600);
          return () => window.clearTimeout(timer);
        }, []);
        return painted ? <output data-testid="asset-count">3</output> : null;
      };
      window.mountGridCell = () => root.render(<>
        <div style={{height: 2000}} />
        <section data-testid="${widgetKey}" style={{minHeight: 200}}>
          <DeferredWidget minHeight={200} data-testid="deferred-widget-${widgetKey}">
            <LateWidget />
          </DeferredWidget>
        </section>
      </>);`,
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

for (const assertion of ['visibility', 'asset count']) {
  test(`${assertion} reveals a deferred widget when its layout arrives later`, async ({
    page,
  }) => {
    // An inner visibility assertion would wait five seconds without scrolling
    // the newly mounted slot. The outer poll must remain free to reveal it.
    test.setTimeout(4_000);
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => {
      (window as unknown as { mountLayout: () => void }).mountLayout();
    });

    if (assertion === 'visibility') {
      await waitForLandingPageWidget(page, widgetKey);
    } else {
      await verifyWidgetCountOnCurrentPage(
        page,
        widgetKey,
        '[data-testid="asset-count"]',
        3
      );
    }

    await expect(page.getByTestId('asset-count')).toHaveText('3');
    await expect(page.getByTestId(widgetKey)).toBeInViewport();
  });
}

test('a visible grid cell is not ready until its deferred slot mounts the widget', async ({
  page,
}) => {
  // The real grid cell wraps the slot, so it is visible before the widget mounts.
  test.setTimeout(4_000);
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    (window as unknown as { mountGridCell: () => void }).mountGridCell();
  });

  await waitForLandingPageWidget(page, widgetKey);

  // Read once rather than retried: a retrying assertion would wait for the
  // late paint and pass whether or not the helper waited for it.
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { lateWidgetPainted?: boolean }).lateWidgetPainted
    )
  ).toBe(true);
  await expect(page.getByTestId('asset-count')).toHaveText('3');
  await expect(page.getByTestId(widgetKey)).toBeInViewport();
});
