/*
 *  Copyright 2022 Collate.
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
/* eslint-disable */
const $RefParser = require('@apidevtools/json-schema-ref-parser');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const process = require('process');

const cwd = process.cwd();

const schemaDir =
  '../../../../../openmetadata-spec/src/main/resources/json/schema';

const rootDir = 'connTemp';
const srcDir = 'schema/entity/services/connections';
const destDir = 'src/jsons/connectionSchemas/connections';

const playDir = `${rootDir}/${srcDir}`;

const globalParserOptions = {
  continueOnError: true,
  dereference: {
    circular: true,
  },
};

const parser = new $RefParser(globalParserOptions);

function removeObjectByKey(obj, keyToRemove) {
  if (typeof (obj) == 'object') {
    for (const prop in obj) {
      if (prop === keyToRemove) {
        // If the property key matches the key to remove, delete it
        delete obj[prop];
      } else {
        // Recursively call the function on the property's value
        obj[prop] = removeObjectByKey(obj[prop], keyToRemove);
      }
    }
  }
  return obj

}


async function parseSchema(filePath, destPath) {
  try {
    const fileDir = `${cwd}/${path.dirname(filePath)}`;
    const fileName = path.basename(filePath);
    process.chdir(fileDir);
    const parsedSchema = await parser.parse(fileName);
    const schema = await parser.dereference(parsedSchema);
    const api = await parser.bundle(schema);
    const dirname = `${cwd}/${path.dirname(destPath)}`;

    const api_removed_id = removeObjectByKey(api, '$id');
    if (!fs.existsSync(dirname)) {
      try {
        fs.mkdirSync(dirname, { recursive: true });
      } catch (err) {
        console.log(err);
      }
    }
    fs.writeFileSync(`${cwd}/${destPath}`, JSON.stringify(api_removed_id, null, 2));
  } catch (err) {
    console.log(err);
  } finally {
    process.chdir(cwd);
  }
}

async function traverseDirectory(Directory) {
  const Files = fs.readdirSync(Directory);
  for (const File of Files) {
    const Absolute = path.join(Directory, File);
    if (fs.statSync(Absolute).isDirectory()) {
      await traverseDirectory(Absolute);
    } else {
      const name = Absolute.replace(playDir, destDir);
      await parseSchema(Absolute, name);
    }
  }
}

function copySourceFiles() {
  try {
    fse.copySync(schemaDir, `${rootDir}/schema`);
  } catch (err) {
    console.error(err);
  }
}

async function main() {
  try {
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true });
    }
    fs.mkdirSync(destDir, { recursive: true });
    copySourceFiles();

    await traverseDirectory(`${playDir}`);
  } catch (err) {
    console.log(err);
  }
}

main();
