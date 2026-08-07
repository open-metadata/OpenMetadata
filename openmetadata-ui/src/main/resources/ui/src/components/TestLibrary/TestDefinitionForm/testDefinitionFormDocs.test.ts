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
import fs from 'fs';
import i18next from 'i18next';
import path from 'path';
import enUs from '../../../locale/languages/en-us.json';
import { TEST_DEFINITION_FIELD_DOCS } from './testDefinitionFormDocs';

// Every Test Definition form field whose per-field doc backs the modal Form-Hint
// popover. The popover sources its copy from TestDefinitionForm.md at runtime and
// falls back to these i18n keys, so each key MUST resolve in en-US.
const EXPECTED_FIELDS = [
  'name',
  'displayName',
  'description',
  'sqlExpression',
  'entityType',
  'testPlatforms',
  'dataQualityDimension',
  'supportedServices',
  'supportedDataTypes',
  'parameterDefinition',
];

// Fields whose docs intentionally reuse an existing, already-localized drawer
// helper key instead of a dedicated `doc-field-*` key.
const REUSED_FIELDS: Record<string, string> = {
  sqlExpression: 'message.test-definition-sql-query-help',
  supportedServices: 'message.supported-services-help',
  parameterDefinition: 'message.test-definition-parameters-description',
};

const messages = enUs.message as unknown as Record<string, string>;
const resolvesInEnUs = (docKey: string): boolean =>
  Boolean(messages[docKey.replace('message.', '')]);

describe('TEST_DEFINITION_FIELD_DOCS', () => {
  it('has a doc key for every form field and no extras', () => {
    expect(Object.keys(TEST_DEFINITION_FIELD_DOCS).sort()).toEqual(
      [...EXPECTED_FIELDS].sort()
    );
  });

  it('maps every field to a non-empty i18n key string', () => {
    Object.values(TEST_DEFINITION_FIELD_DOCS).forEach((docKey) => {
      expect(typeof docKey).toBe('string');
      expect(docKey.length).toBeGreaterThan(0);
    });
  });

  it('every field doc key resolves in en-US so the popover always has fallback copy', () => {
    EXPECTED_FIELDS.forEach((field) => {
      expect(resolvesInEnUs(TEST_DEFINITION_FIELD_DOCS[field])).toBe(true);
    });
  });

  it('reuses the existing drawer helper keys for the shared fields', () => {
    Object.entries(REUSED_FIELDS).forEach(([field, key]) => {
      expect(TEST_DEFINITION_FIELD_DOCS[field]).toBe(key);
    });
  });
});

// The sqlExpression help text is the only place a user learns the template
// syntax, and `compile_sql_expression` on the ingestion side renders it with
// Jinja2 under StrictUndefined. Jinja2 leaves single-brace `{table}` untouched
// rather than erroring, so wrong copy here yields silently-unsubstituted SQL and
// an opaque engine-side syntax error. See issue #30659.
const SQL_HELP_KEY = 'test-definition-sql-query-help';
const REQUIRED_PLACEHOLDERS = ['{{ table_name }}', '{{ column_name }}'];
const FORBIDDEN_PLACEHOLDERS = ['{table}', '{column}'];

const readSqlExpressionMarkdownSection = (): string => {
  const markdown = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../../public/locales/en-US/OpenMetadata/TestDefinitionForm.md'
    ),
    'utf-8'
  );
  const section = markdown
    .split('$$section')
    .find((block) => block.includes('$(id="sqlExpression")'));

  return section ?? '';
};

describe('Test Definition SQL expression help copy', () => {
  // Resolve through the real production i18next config rather than reading the
  // raw JSON: i18next also owns `{{ }}`, so this proves the Jinja2 placeholders
  // survive interpolation instead of being eaten as i18next variables.
  const resolveSqlHelp = async (): Promise<string> => {
    const instance = i18next.createInstance();
    await instance.init({
      lng: 'en-US',
      resources: { 'en-US': { translation: enUs } },
      interpolation: {
        escapeValue: false,
        defaultVariables: { brandName: 'OpenMetadata' },
      },
    });

    return instance.t(`message.${SQL_HELP_KEY}`);
  };

  it('documents the Jinja2 placeholders the ingestion renderer actually substitutes', async () => {
    const helpText = await resolveSqlHelp();

    REQUIRED_PLACEHOLDERS.forEach((placeholder) => {
      expect(helpText).toContain(placeholder);
    });
  });

  it('does not document the single-brace placeholders, which are never substituted', async () => {
    const helpText = await resolveSqlHelp();

    FORBIDDEN_PLACEHOLDERS.forEach((placeholder) => {
      expect(helpText).not.toContain(placeholder);
    });
  });

  it('keeps the brand name interpolated so the copy is not literally "{{brandName}}"', async () => {
    const helpText = await resolveSqlHelp();

    expect(helpText).toContain('OpenMetadata');
    expect(helpText).not.toContain('{{brandName}}');
  });

  it('documents the same Jinja2 placeholders in the form-hint markdown', () => {
    const section = readSqlExpressionMarkdownSection();

    expect(section).not.toHaveLength(0);

    REQUIRED_PLACEHOLDERS.forEach((placeholder) => {
      expect(section).toContain(placeholder);
    });
  });

  it('does not leave single-brace placeholders in the form-hint markdown', () => {
    const section = readSqlExpressionMarkdownSection();

    FORBIDDEN_PLACEHOLDERS.forEach((placeholder) => {
      // Allowed only inside the explicit "these do not work" warning, which is
      // why the check is scoped to backtick-free prose occurrences.
      expect(section.replace(/`[^`]*`/g, '')).not.toContain(placeholder);
    });
  });
});
