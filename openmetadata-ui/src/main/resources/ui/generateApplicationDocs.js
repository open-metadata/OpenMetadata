/*
 *  Copyright 2025 Collate.
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
const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, './src/utils/ApplicationSchemas');
const DOCS_DIR = path.join(__dirname, './public/locales/en-US/Applications');

const processProperty = (key, prop) => {
  let markdown = `$$section\n`;
  markdown += `### ${prop.title || key} $(id="${key}")\n\n`;

  if (prop.description) {
    markdown += `${prop.description}\n\n`;
  }

  // Handle nested properties if they exist
  if (prop.properties) {
    for (const [nestedKey, nestedProp] of Object.entries(prop.properties)) {
      markdown += processProperty(`${key}.${nestedKey}`, nestedProp);
    }
  }

  markdown += `$$\n\n`;
  return markdown;
};

const generateMarkdown = (schema) => {
  let markdown = `# ${schema.title || 'Application Configuration'}\n\n`;

  if (schema.description) {
    markdown += `${schema.description}\n\n`;
  }

  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      markdown += processProperty(key, prop);
    }
  }

  return markdown.trim();
};

const parseAndGenerateDocs = () => {
  // Ensure docs directory exists
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  // Read all JSON files from schema directory
  const schemaFiles = fs
    .readdirSync(SCHEMA_DIR)
    .filter((file) => file.endsWith('.json'));

  schemaFiles.forEach((schemaFile) => {
    try {
      const schemaPath = path.join(SCHEMA_DIR, schemaFile);
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
      const baseName = path
        .basename(schemaFile, '.json')
        .replace('-collate', '');

      const markdown = generateMarkdown(schema);

      fs.writeFileSync(
        path.join(DOCS_DIR, `${baseName}.md`),
        markdown,
        'utf-8'
      );

      console.log(`✓ Generated documentation for ${baseName}`);
    } catch (error) {
      console.error(`✗ Error processing ${schemaFile}:`, error);
    }
  });
};

parseAndGenerateDocs();
