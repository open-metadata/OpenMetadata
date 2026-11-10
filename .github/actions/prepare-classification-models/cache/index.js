// Copyright 2026 Collate
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

async function main() {
  if (
    (!process.env.ACTIONS_CACHE_URL && !process.env.ACTIONS_RESULTS_URL) ||
    !process.env.ACTIONS_RUNTIME_TOKEN
  ) {
    throw new Error(
      "Actions cache runtime unavailable; invoke the native JavaScript action",
    );
  }
  const [operation, key, resultFile] = process.argv.slice(2);
  if (operation) {
    const cache = require("@actions/cache");
    const archive = ["model-cache/model.tar"];
    const result =
      operation === "restore"
        ? await cache.restoreCache(archive, key)
        : await cache.saveCache(archive, key);
    fs.writeFileSync(resultFile, JSON.stringify(result ?? null));
    return;
  }
  const args = [
    path.join(
      process.env.GITHUB_WORKSPACE,
      "scripts/prepare_classification_models.py",
    ),
    "batch",
    "--models",
    process.env.MODELS,
    "--archives",
    process.env.ARCHIVE_DIRECTORY,
    "--uv-version",
    process.env.UV_VERSION,
    "--cache-command",
    "node",
    __filename,
  ];
  if (process.env.SAVE_CACHE === "true") args.push("--save-cache");
  const result = spawnSync("python", args, { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
