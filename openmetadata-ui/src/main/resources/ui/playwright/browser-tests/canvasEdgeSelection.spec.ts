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

const bundle = buildSync({
  entryPoints: ['src/utils/Lineage/CanvasHitTest.utils.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'canvasHitTesting',
}).outputFiles[0].text;

for (const zoom of [0.1, 1, 2]) {
  for (const reverse of [false, true]) {
    test(`selects the closest canvas edge at zoom ${zoom}, reversed order ${reverse}`, async ({
      page,
    }) => {
      await page.setContent(
        '<canvas data-testid="graph" width="400" height="400"></canvas><output></output>'
      );
      await page.addScriptTag({ content: bundle });
      await page.addScriptTag({
        content: `const { findClosestCanvasEdge } = canvasHitTesting;
            const canvas = document.querySelector('canvas');
            const context = canvas.getContext('2d');
            const hitContext = new OffscreenCanvas(1, 1).getContext('2d');
            const paths = ['upper', 'lower'].map((edge, index) => {
              const y = 100 + index * 30;
              const path = new Path2D();
              path.moveTo(20, y);
              path.bezierCurveTo(80, y - 20, 120, y + 20, 180, y);
              return { edge, path };
            });
            context.translate(20, 20);
            context.scale(${zoom}, ${zoom});
            context.lineWidth = 1 / ${zoom};
            for (const { path } of paths) context.stroke(path);
            if (${reverse}) paths.reverse();
            canvas.addEventListener('click', (event) => {
              const bounds = canvas.getBoundingClientRect();
              const edge = findClosestCanvasEdge(hitContext, paths,
                (event.clientX - bounds.left - 20) / ${zoom},
                (event.clientY - bounds.top - 20) / ${zoom}, 12 / ${zoom});
              document.querySelector('output').textContent = edge ?? 'no edge';
            });`,
      });

      for (const [edge, y] of [
        ['upper', 100],
        ['lower', 130],
      ] as const) {
        await page
          .getByTestId('graph')
          .click({ position: { x: 20 + 100 * zoom, y: 20 + y * zoom } });
        await expect(page.locator('output')).toHaveText(edge);
      }
      await page.getByTestId('graph').click({ position: { x: 380, y: 380 } });
      await expect(page.locator('output')).toHaveText('no edge');
    });
  }
}
