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

async function prepareModels(
  models,
  { directory, helper, write, uvVersion },
  cache,
) {
  const archive = "model-cache/model.tar";
  fs.rmSync(directory, { recursive: true, force: true });
  for (const model of models) {
    fs.rmSync("model-cache", { recursive: true, force: true });
    let restored;
    try {
      restored = await cache.restoreCache([archive], model.key);
    } catch (error) {
      console.warn(`Cache restore failed for ${model.name}: ${error.message}`);
    }
    if (restored !== model.key) {
      const args = [
        helper,
        "prepare",
        "--requirement",
        model.requirement,
        "--uv-version",
        model["uv-version"],
        "--output",
        archive,
      ];
      const result =
        model["uv-version"] === uvVersion
          ? spawnSync("python", args, { stdio: "inherit", timeout: 660000 })
          : spawnSync(
              "uv",
              [
                "run",
                "--no-project",
                "--with",
                `uv==${model["uv-version"]}`,
                "python",
                ...args,
              ],
              { stdio: "inherit", timeout: 720000 },
            );
      if (result.error) throw result.error;
      if (result.status !== 0)
        throw new Error(`Model preparation failed: ${model.name}`);
      if (write && (await cache.saveCache([archive], model.key)) < 0) {
        throw new Error(`Cache save failed: ${model.name}`);
      }
    }
    if (!write) {
      const destination = path.join(directory, model.key, "model.tar");
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(archive, destination);
    }
    console.log(
      `${model.name}: ${restored === model.key ? "cache hit" : "prepared"}`,
    );
  }
  fs.rmSync("model-cache", { recursive: true, force: true });
}

if (require.main === module) {
  prepareModels(
    JSON.parse(process.env.MODELS),
    {
      directory: process.env.ARCHIVE_DIRECTORY,
      helper: path.join(
        process.env.GITHUB_WORKSPACE,
        "scripts/prepare_classification_models.py",
      ),
      write: process.env.SAVE_CACHE === "true",
      uvVersion: process.env.UV_VERSION,
    },
    require("@actions/cache"),
  ).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { prepareModels };
