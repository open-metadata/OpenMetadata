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
import { expect, test } from '@playwright/test';
import { RJSFSchema } from '@rjsf/utils';
import { customizeValidator } from '@rjsf/validator-ajv8';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import fixtures from '../fixtures/visual/entities.json';
import resources from '../fixtures/visual/resources.json';
import workflowInstanceStates from '../fixtures/visual/workflow-instance-states.json';
import workflowInstances from '../fixtures/visual/workflow-instances.json';

const schemaRoot = path.resolve(
  __dirname,
  '../../../../../../../openmetadata-spec/src/main/resources/json/schema'
);

const readSchemas = (
  directory: string
): { filename: string; schema: RJSFSchema }[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return readSchemas(filename);
    if (!entry.name.endsWith('.json')) return [];
    const schema = JSON.parse(readFileSync(filename, 'utf8'), (key, value) => {
      // Backend schemas use Java's Unicode word flag; preserve it in ECMAScript.
      if (
        key === 'pattern' &&
        typeof value === 'string' &&
        value.startsWith('(?U)')
      ) {
        return value
          .slice(4)
          .replace(
            /\\w/g,
            '[\\p{Alphabetic}\\p{M}\\p{Nd}\\p{Pc}\\u200c\\u200d]'
          );
      }
      return value;
    }) as RJSFSchema;
    if (!schema || typeof schema !== 'object' || Array.isArray(schema))
      return [];
    // Filesystem IDs keep relative references inside the checked-in schema tree.
    return [
      { filename, schema: { ...schema, $id: pathToFileURL(filename).href } },
    ];
  });

const schemas = readSchemas(schemaRoot);
const validator = customizeValidator({
  ajvOptionsOverrides: {
    formats: {
      'utc-millisec': { type: 'number', validate: Number.isSafeInteger },
    },
    strict: false,
    // These backend schemas declare draft 2020 and Java generator keywords;
    // validate their data contracts without requiring an AJV metaschema plugin.
    validateSchema: false,
    // Entity versions advance by 0.1; allow JavaScript division round-off.
    multipleOfPrecision: 8,
    schemas: schemas.map(({ schema }) => schema),
  },
});

const resourceFixtures = Object.entries(resources)
  .filter(
    ([collection]) =>
      (collection.startsWith('services/') &&
        collection !== 'services/ingestionPipelines') ||
      collection === 'events/subscriptions'
  )
  .flatMap(([, services]) =>
    services.map((service) => {
      // The fixture's discriminator selects its schema; it is not an API field.
      const { type, ...entity } = service as Record<string, unknown> & {
        type: string;
      };
      return { type, entity };
    })
  );

const workflowFixtures = [
  ...workflowInstances.map((entity) => ({ type: 'workflowInstance', entity })),
  ...workflowInstanceStates.map((entity) => ({
    type: 'workflowInstanceState',
    entity,
  })),
];

for (const fixture of [...fixtures, ...resourceFixtures, ...workflowFixtures]) {
  test(`${fixture.type} ${fixture.entity.id} visual fixture follows its current schema`, () => {
    const matches = schemas.filter(
      ({ filename, schema }) =>
        path.basename(filename) === `${fixture.type}.json` &&
        Boolean(schema.properties?.id) &&
        (fixture.type.startsWith('workflowInstance') ||
          Boolean(schema.properties?.fullyQualifiedName))
    );
    expect(matches).toHaveLength(1);
    const { errors, validationError } = validator.rawValidation(
      matches[0].schema,
      fixture.entity
    );
    expect(validationError).toBeUndefined();
    expect(
      errors?.map(({ instancePath, message, params }) => ({
        instancePath,
        message,
        params,
      })) ?? []
    ).toEqual([]);
  });
}
