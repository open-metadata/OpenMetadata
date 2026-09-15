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

// Every CI install runs `yarn --ignore-scripts`, so postinstall never fires on
// a runner. Correct playwright-core here instead: this runs once in the parent
// process before any worker is forked, and workers read the file from disk.
import { patchPlaywright } from '../scripts/patch-playwright-indexeddb.cjs';

const globalSetup = async () => {
  console.log(`playwright-core storage script: ${patchPlaywright()}`);
};

export default globalSetup;
