/*
 * Copyright 2026 Collate
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const prefix = 'playwright-results-json-';

function readEvidence(directory, file) {
  const filename = path.join(directory, file);
  if (fs.statSync(filename).size > 64 * 1024 * 1024) {
    throw new Error(`Oversized execution evidence: ${filename}`);
  }
  const bytes = fs.readFileSync(filename);
  return {
    digest: createHash('sha256').update(bytes).digest('hex'),
    value: JSON.parse(bytes.toString('utf8')),
  };
}

function normalizeArtifacts(root, expectedHeadSha = '') {
  if (!fs.existsSync(root)) throw new Error('No execution artifacts were downloaded');
  // download-artifact can flatten a pattern matching a single artifact.
  if (fs.existsSync(path.join(root, 'results.json'))) {
    const { value: status } = readEvidence(root, 'ci-status.json');
    if (!/^[a-z0-9-]+$/.test(status.shard ?? '')) {
      throw new Error('Flat results have no valid shard identity');
    }
    const directory = path.join(root, `${prefix}${status.shard}`);
    if (fs.existsSync(directory)) throw new Error('Conflicting flat and nested results');
    fs.mkdirSync(directory);
    for (const file of ['results.json', 'ci-status.json']) {
      fs.renameSync(path.join(root, file), path.join(directory, file));
    }
  }
  const directories = fs.readdirSync(root).filter(name => name.startsWith(prefix)).sort();
  if (directories.length === 0) throw new Error('No execution artifacts were downloaded');
  if (directories.length > 256) throw new Error('Too many result artifacts');
  const byShard = new Map();
  for (const directory of directories) {
    const shard = directory.slice(prefix.length).replace(/-retry$/, '');
    const location = path.join(root, directory);
    const report = readEvidence(location, 'results.json');
    const status = readEvidence(location, 'ci-status.json');
    if (!Array.isArray(report.value.suites)) throw new Error(`Invalid results for ${shard}`);
    if ((expectedHeadSha || status.value.shard) && status.value.shard !== shard) {
      throw new Error(`Wrong shard identity for ${directory}`);
    }
    if (expectedHeadSha && status.value.headSha !== expectedHeadSha) {
      throw new Error(`Wrong commit for ${directory}: expected ${expectedHeadSha}`);
    }
    const candidates = byShard.get(shard) ?? [];
    candidates.push({
      directory,
      reportDigest: report.digest,
      statusDigest: status.digest,
      runId: status.value.runId,
      attempt: Number(status.value.runAttempt),
    });
    byShard.set(shard, candidates);
  }
  const operations = [];
  for (const [shard, candidates] of byShard) {
    const runIds = new Set(candidates.map(candidate => candidate.runId));
    if (runIds.size > 1) throw new Error(`Conflicting workflow runs for ${shard}`);
    // Re-running failed jobs leaves successful shards on earlier attempts.
    // Within one shard, a newer workflow execution supersedes its old fallback;
    // duplicate transports of that execution must still be identical.
    const identifiedAttempts = expectedHeadSha && candidates[0].runId &&
      candidates.every(candidate => Number.isSafeInteger(candidate.attempt) && candidate.attempt > 0);
    const latestAttempt = identifiedAttempts
      ? Math.max(...candidates.map(candidate => candidate.attempt)) : undefined;
    const current = identifiedAttempts
      ? candidates.filter(candidate => candidate.attempt === latestAttempt) : candidates;
    const source = current[0];
    if (current.some(candidate => candidate.reportDigest !== source.reportDigest ||
        candidate.statusDigest !== source.statusDigest)) {
      throw new Error(`Conflicting execution evidence for ${shard}`);
    }
    operations.push({ shard, source, candidates });
  }
  for (const { shard, source, candidates } of operations) {
    const canonical = `${prefix}${shard}`;
    for (const candidate of candidates) {
      if (candidate !== source) fs.rmSync(path.join(root, candidate.directory), { recursive: true });
    }
    if (source.directory !== canonical) fs.renameSync(path.join(root, source.directory), path.join(root, canonical));
  }
}

if (require.main === module) {
  try {
    normalizeArtifacts(process.argv[2], process.argv[3]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { normalizeArtifacts };
