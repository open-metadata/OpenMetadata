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
/* eslint-disable */
const $RefParser = require('@apidevtools/json-schema-ref-parser');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const process = require('process');

const cwd = process.cwd();

const schemaDir =
  '../../../../../openmetadata-spec/src/main/resources/json/schema';

const globalParserOptions = {
  continueOnError: true,
  dereference: {
    circular: true,
  },
};

const parser = new $RefParser(globalParserOptions);

// Function to recursively remove any object by key
function removeObjectByKey(obj, keyToRemove) {
  if (typeof obj == 'object') {
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
  return obj;
}

async function parseSchema(filePath, destPath, shouldDereference = false) {
  try {
    const fileDir = `${cwd}/${path.dirname(filePath)}`;
    const fileName = path.basename(filePath);
    process.chdir(fileDir);

    let parsedSchema = await parser.parse(fileName);
    if (shouldDereference || fileName.startsWith('dbt')) {
      parsedSchema = await parser.dereference(parsedSchema);
    }
    const api = await parser.bundle(parsedSchema);
    const dirname = `${cwd}/${path.dirname(destPath)}`;
    const updatedAPIWithoutID = removeObjectByKey(api, '$id');

    if (!fs.existsSync(dirname)) {
      try {
        fs.mkdirSync(dirname, { recursive: true });
      } catch (err) {
        console.log(err);
      }
    }
    fs.writeFileSync(
      `${cwd}/${destPath}`,
      JSON.stringify(updatedAPIWithoutID, null, 2)
    );
  } catch (err) {
    console.log(err);
  } finally {
    process.chdir(cwd);
  }
}

// Function to traverse directories and parse files
async function traverseDirectory(
  Directory,
  playDir,
  destDir,
  shouldDereference = false
) {
  const Files = fs.readdirSync(Directory);
  for (const File of Files) {
    const Absolute = path.join(Directory, File);
    if (fs.statSync(Absolute).isDirectory()) {
      await traverseDirectory(Absolute, playDir, destDir, shouldDereference);
    } else {
      const name = Absolute.replace(playDir, destDir);
      await parseSchema(Absolute, name, shouldDereference);
    }
  }
}

// Function to copy source files
function copySourceFiles(rootDir) {
  try {
    fse.copySync(schemaDir, `${rootDir}/schema`);
  } catch (err) {
    console.error(err);
  }
}

// Main function to handle schema parsing
async function main(rootDir, srcDir, destDir, shouldDereference = false) {
  const playDir = `${rootDir}/${srcDir}`;

  try {
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true });
    }
    fs.mkdirSync(destDir, { recursive: true });

    copySourceFiles(rootDir);

    await traverseDirectory(playDir, playDir, destDir, shouldDereference);
  } catch (err) {
    console.log(err);
  } finally {
    // Cleanup: Remove the temporary directory
    if (fs.existsSync(rootDir)) {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  }
}

// Function to parse Application schemas
async function parseApplicationSchemas() {
  const appSchemaDir = 'src/utils/ApplicationSchemas';
  const destDir = 'src/jsons/applicationSchemas';
  
  try {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    } else {
      // Clean existing destination directory
      fs.rmSync(destDir, { recursive: true });
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Get all JSON files in ApplicationSchemas directory
    const files = fs.readdirSync(appSchemaDir).filter(file => file.endsWith('.json'));
    
    for (const file of files) {
      const filePath = path.join(appSchemaDir, file);
      const destPath = path.join(destDir, file);
      
      try {
        // Change to the source directory for relative path resolution
        const fileDir = path.dirname(filePath);
        const originalCwd = process.cwd();
        process.chdir(fileDir);
        
        // Parse and dereference the schema
        let parsedSchema = await parser.parse(file);
        parsedSchema = await parser.dereference(parsedSchema);
        
        // Remove $id fields
        const updatedSchema = removeObjectByKey(parsedSchema, '$id');
        
        // Change back to original directory
        process.chdir(originalCwd);
        
        // Write the processed schema to destination
        fs.writeFileSync(destPath, JSON.stringify(updatedSchema, null, 2));
        console.log(`Processed ApplicationSchema: ${file}`);
      } catch (err) {
        console.error(`Error processing ${file}:`, err.message);
        process.chdir(cwd);
      }
    }
  } catch (err) {
    console.error('Error parsing Application schemas:', err);
  }
}

// Execute the parsing for connection and ingestion schemas
async function runParsers() {
  // For connection schemas
  await main(
    'connTemp',
    'schema/entity/services/connections',
    'src/jsons/connectionSchemas/connections',
    true
  );

  // For ingestion schemas (with dereferencing for dbt schemas)
  await main(
    'ingestionTemp',
    'schema/metadataIngestion',
    'src/jsons/ingestionSchemas'
  );

  await main(
    'workflowTemp',
    'schema/governance/workflows/elements/nodes',
    'src/jsons/governanceSchemas'
  );
  
  // Parse Application schemas
  await parseApplicationSchemas();
}

runParsers();
