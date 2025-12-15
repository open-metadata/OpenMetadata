/*
 *  Copyright 2024 Collate.
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
import { Page } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fullUuid } from './common';

declare global {
  interface Window {
    __coverage__: unknown;
  }
}

export async function collectCoverage(page: Page) {
  const coverage = await page.evaluate(() => window.__coverage__);
  if (coverage) {
    const coveragePath = path.resolve(process.cwd(), '.nyc_output');
    if (!existsSync(coveragePath)) {
      mkdirSync(coveragePath);
    }
    writeFileSync(
      path.join(coveragePath, `coverage-${fullUuid()}.json`),
      JSON.stringify(coverage)
    );
  }
}
