#!/usr/bin/env node
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

// Merges the per-shard Jest output of yarn-coverage.yml back into what a
// single unsharded run wrote: coverage-summary.json for the PR comment and
// test-report.xml for Sonar.
//
//   node merge_jest_shards.cjs <shardsDir> <expectedShards> <uiDir> <coverageDir>
//
// Each <shardsDir>/<shard>/ holds that shard's coverage-final.json and
// test-report.xml. istanbul is resolved from the UI's node_modules (Jest
// already depends on it), so this adds no dependency.
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const [shardsDir, expectedShards, uiDir, coverageDir] = process.argv.slice(2);
const uiRequire = createRequire(path.resolve(uiDir, 'package.json'));
const { createCoverageMap } = uiRequire('istanbul-lib-coverage');
const { createContext } = uiRequire('istanbul-lib-report');
const reports = uiRequire('istanbul-reports');

const shards = fs
  .readdirSync(shardsDir)
  .map((name) => path.join(shardsDir, name))
  .sort();
if (shards.length !== Number(expectedShards)) {
  throw new Error(
    `Expected ${expectedShards} Jest shards, found ${shards.length}: ${shards}`
  );
}

// A shard that never loads a file still reports it (collectCoverageFrom), but
// instruments the raw source, whose statement map differs from the transformed
// one a loading shard records. Merging both inflates the totals, so a file's
// all-zero entries are dropped whenever another shard actually ran it.
const ran = (fileCoverage) => Object.values(fileCoverage.s).some((hits) => hits);
const byFile = new Map();
const testExecutions = [];
for (const shard of shards) {
  const coverage = JSON.parse(
    fs.readFileSync(path.join(shard, 'coverage-final.json'), 'utf8')
  );
  for (const [file, fileCoverage] of Object.entries(coverage)) {
    byFile.set(file, [...(byFile.get(file) ?? []), fileCoverage]);
  }
  const report = fs.readFileSync(path.join(shard, 'test-report.xml'), 'utf8');
  const body = report.match(/<testExecutions[^>]*>([\s\S]*)<\/testExecutions>/);
  if (!body) {
    throw new Error(`No <testExecutions> in ${shard}/test-report.xml`);
  }
  testExecutions.push(body[1]);
}

// Jest merges in-memory coverage by key. coverage-final.json drops the hash
// that enables that, so istanbul's merge() would fall back to merging by
// location and collapse functions that share one (ts-jest emits those),
// under-counting them. Shards that loaded a file record the same maps, so
// their counts are summed by key instead; merge() is left for the rare
// entries whose maps differ.
const sameMaps = (a, b) =>
  ['statementMap', 'fnMap', 'branchMap'].every(
    (key) => JSON.stringify(a[key]) === JSON.stringify(b[key])
  );
const addCounts = (target, other) => {
  for (const key of Object.keys(target.s)) target.s[key] += other.s[key];
  for (const key of Object.keys(target.f)) target.f[key] += other.f[key];
  for (const key of Object.keys(target.b)) {
    target.b[key] = target.b[key].map((hits, i) => hits + other.b[key][i]);
  }
};

const merged = {};
const differing = [];
for (const [file, entries] of byFile) {
  const loaded = entries.filter(ran);
  const [first, ...rest] = loaded.length ? loaded : entries.slice(0, 1);
  merged[file] = structuredClone(first);
  for (const fileCoverage of rest) {
    if (sameMaps(first, fileCoverage)) {
      addCounts(merged[file], fileCoverage);
    } else {
      differing.push({ [file]: fileCoverage });
    }
  }
}
const coverageMap = createCoverageMap(merged);
differing.forEach((entry) => coverageMap.merge(entry));

fs.mkdirSync(coverageDir, { recursive: true });
reports
  .create('json-summary')
  .execute(createContext({ dir: coverageDir, coverageMap }));
fs.writeFileSync(
  path.join(uiDir, 'test-report.xml'),
  `<testExecutions version="1">${testExecutions.join('')}</testExecutions>\n`
);
console.log(`Merged ${shards.length} Jest shards into ${coverageDir}`);
