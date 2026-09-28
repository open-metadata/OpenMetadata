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
  stdin: {
    contents: `import { toCanvas, toSvg } from 'html-to-image';
      import { getExportStyleProperties } from './src/utils/Export/exportStyles.utils';
      window.exportGraph = async () => {
        const element = document.getElementById('graph');
        const options = { includeStyleProperties: getExportStyleProperties(element), pixelRatio: 1 };
        const svg = await toSvg(element, options);
        const canvas = await toCanvas(element, options);
        const context = canvas.getContext('2d');
        const pixel = (x, y) => Array.from(context.getImageData(x, y, 1, 1).data);
        return {
          width: canvas.width, height: canvas.height,
          customPropertiesInSvg: decodeURIComponent(svg).includes('--unused-theme-'),
          cards: Array.from({ length: 85 }, (_, i) => ({
            background: pixel((i % 10) * 40 + 5, Math.floor(i / 10) * 40 + 5),
            icon: pixel((i % 10) * 40 + 20, Math.floor(i / 10) * 40 + 20),
            pseudo: pixel((i % 10) * 40 + 35, Math.floor(i / 10) * 40 + 35),
          })),
        };
      };`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
}).outputFiles[0].text;

for (const variableCount of [0, 1800]) {
  test(`PNG preserves every node, SVG icon and pseudo-element with ${variableCount} inherited variables`, async ({
    page,
  }) => {
    const theme = Array.from(
      { length: variableCount },
      (_, i) => `--unused-theme-${i}:rgb(1,2,3);`
    ).join('');
    await page.setContent(`<style>
      :root { ${theme} --card:rgb(0,255,0); --icon:rgb(0,0,255); --pseudo:rgb(255,0,0); }
      #graph { display:flex; flex-wrap:wrap; width:400px; height:360px; background:white; }
      .card { width:40px; height:40px; position:relative; background:var(--card); }
      .card svg { position:absolute; left:10px; top:10px; fill:var(--icon); }
      .card::after { content:''; position:absolute; right:0; bottom:0; width:10px; height:10px; background:var(--pseudo); }
      </style><div id="graph">${Array.from(
        { length: 85 },
        () =>
          '<div class="card"><svg width="20" height="20"><circle cx="10" cy="10" r="9"/></svg></div>'
      ).join('')}</div>`);
    await page.addScriptTag({ content: bundle });
    const result = await page.evaluate(() =>
      (
        window as unknown as {
          exportGraph: () => Promise<{
            width: number;
            height: number;
            customPropertiesInSvg: boolean;
            cards: { background: number[]; icon: number[]; pseudo: number[] }[];
          }>;
        }
      ).exportGraph()
    );
    expect(result.width).toBe(400);
    expect(result.height).toBe(360);
    expect(result.customPropertiesInSvg).toBe(false);
    expect(result.cards).toHaveLength(85);
    for (const card of result.cards) {
      expect(card.background).toEqual([0, 255, 0, 255]);
      expect(card.icon).toEqual([0, 0, 255, 255]);
      expect(card.pseudo).toEqual([255, 0, 0, 255]);
    }
  });
}
