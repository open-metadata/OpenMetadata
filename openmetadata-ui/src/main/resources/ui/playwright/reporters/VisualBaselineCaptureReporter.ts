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
import { cpSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import type { FullConfig, Reporter } from '@playwright/test/reporter';

export default class VisualBaselineCaptureReporter implements Reporter {
  private sourceDir?: string;
  private reportDir?: string;

  constructor(options: { sourceDir?: string; reportDir?: string } = {}) {
    this.sourceDir = options.sourceDir;
    this.reportDir = options.reportDir;
  }

  onBegin(config: FullConfig) {
    if (!config.configFile)
      throw new Error('Capture runs require a configuration file.');
    const root = dirname(config.configFile);
    this.sourceDir ??= resolve(
      root,
      'playwright/output/test-results/visual-generated'
    );
    this.reportDir ??= resolve(
      root,
      'playwright/output/blob-report/visual-generated'
    );
  }

  onExit() {
    // Successful runs only retain the blob artifact in the existing workflow.
    // Copy after reporters finish, so blob cleanup cannot erase the captures.
    if (this.sourceDir && this.reportDir && existsSync(this.sourceDir)) {
      mkdirSync(dirname(this.reportDir), { recursive: true });
      cpSync(this.sourceDir, this.reportDir, { recursive: true });
    }
  }
}
