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
const fs = require('node:fs');
const path = require('node:path');

const uiRoot = path.resolve(__dirname, '../..');
const readFixture = (name) =>
  JSON.parse(
    fs.readFileSync(
      path.join(uiRoot, 'playwright/fixtures/visual', name),
      'utf8'
    )
  );
const scenes = readFixture('scenarios.json');
const connectors = readFixture('connectors.json');
const controls = readFixture('control-scenarios.json');
const snapshotRoot = path.join(
  uiRoot,
  'playwright/e2e/VisualRegression/__snapshots__'
);
const screenshots = fs
  .readdirSync(snapshotRoot, { recursive: true })
  .filter((file) => file.endsWith('.png'))
  .map((file) => ({
    file,
    bytes: fs.statSync(path.join(snapshotRoot, file)).size,
    theme: file.endsWith('-dark.png') ? 'dark' : 'light',
  }));
const uniqueSceneIds = new Set(scenes.map(({ id }) => id));
if (uniqueSceneIds.size !== scenes.length) {
  throw new Error('Visual scene IDs must be unique across the catalog.');
}

const themeCount = (scene) => (scene.mode === 'classic' ? 1 : 2);
const frameCaptures = scenes
  .filter((scene) => scene.group === 'Forms' && scene.target)
  .reduce((total, scene) => total + themeCount(scene), 0);
const groups = Object.fromEntries(
  [...new Set(scenes.map(({ group }) => group))].map((group) => [
    group,
    scenes
      .filter((scene) => scene.group === group)
      .reduce((total, scene) => total + themeCount(scene), 0),
  ])
);
const connectorCategories = new Set(connectors.map(({ category }) => category));
// Optional sections and key-pair authentication depend on the rendered schema.
// Report those from real baselines rather than inventing a static total.
const conditionalConnectorCaptures = screenshots.filter(({ file }) =>
  /connectorForms\.spec\.ts-snapshots\/.*-(expanded|keypair)(-dark)?\.png$/.test(
    file
  )
).length;
const report = {
  configured: {
    applicationStatesByTheme: groups,
    connectorForms: connectors.length,
    connectorCategories: connectorCategories.size,
    connectorDefaultCaptures:
      (connectors.length + connectorCategories.size * 2) * 2,
    sharedControlStates: controls.length,
    sharedControlCaptures: controls.length * 2,
    formFrameCaptures: frameCaptures,
    classicCaptures: 14,
    publicAuthenticationCaptures: 10,
    additionalAiAndMetricAndDeleteCaptures: 12,
    minimumCaptures:
      scenes.reduce((total, scene) => total + themeCount(scene), 0) +
      frameCaptures +
      (connectors.length + connectorCategories.size * 2) * 2 +
      controls.length * 2 +
      36,
  },
  onDisk: {
    screenshots: screenshots.length,
    light: screenshots.filter(({ theme }) => theme === 'light').length,
    dark: screenshots.filter(({ theme }) => theme === 'dark').length,
    bytes: screenshots.reduce((sum, { bytes }) => sum + bytes, 0),
    conditionalConnectorCaptures,
  },
  // Existence is deliberately separate from verification: neither a generated
  // image nor this report proves a comparison passed on the CI renderer.
  screenshots,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
