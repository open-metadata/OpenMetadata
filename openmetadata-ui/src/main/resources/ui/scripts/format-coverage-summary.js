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

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const coverageSummaryPath = path.resolve(
  __dirname,
  '../coverage/coverage-summary.json'
);

if (!fs.existsSync(coverageSummaryPath)) {
  console.error('Coverage summary not found at:', coverageSummaryPath);
  process.exit(1);
}

const summary = require(coverageSummaryPath);
const total = summary.total;

const markdown = `
### Code Coverage Summary

| Category | % | Covered / Total |
| :--- | :--- | :--- |
| **Statements** | ${total.statements.pct}% | ${total.statements.covered} / ${total.statements.total} |
| **Branches** | ${total.branches.pct}% | ${total.branches.covered} / ${total.branches.total} |
| **Functions** | ${total.functions.pct}% | ${total.functions.covered} / ${total.functions.total} |
| **Lines** | ${total.lines.pct}% | ${total.lines.covered} / ${total.lines.total} |
`;

console.log(markdown);
