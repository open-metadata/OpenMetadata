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
import validator from '@rjsf/validator-ajv8';
import { readFileSync } from 'fs';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { resolve } from 'path';
import { TableClass } from '../support/entity/TableClass';

const pipelineSchema = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      '../../../../../../../openmetadata-spec/src/main/resources/json/schema/entity/services/ingestionPipelines/ingestionPipeline.json'
    ),
    'utf8'
  )
);

for (const scenario of [
  { name: 'unscheduled', interval: null, expected: {} },
  {
    name: 'default schedule',
    interval: undefined,
    expected: { scheduleInterval: '0 * * * *' },
  },
  {
    name: 'custom schedule',
    interval: '0 2 * * *',
    expected: { scheduleInterval: '0 2 * * *' },
  },
]) {
  test(`test suite pipeline: ${scenario.name}`, async ({ playwright }) => {
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.from(chunk));
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      response.setHeader('Content-Type', 'application/json');
      if (request.url === '/api/v1/dataQuality/testSuites/basic') {
        response.writeHead(201);
        response.end(JSON.stringify({ ...body, id: 'fixture-suite' }));
      } else if (request.url === '/api/v1/services/ingestionPipelines') {
        const validation = validator.rawValidation(
          {
            type: 'object',
            properties: {
              scheduleInterval:
                pipelineSchema.definitions.airflowConfig.properties
                  .scheduleInterval,
            },
          },
          body.airflowConfig
        );
        response.writeHead(validation.errors?.length ? 400 : 201);
        response.end(
          JSON.stringify(
            validation.errors?.length
              ? { errors: validation.errors }
              : { ...body, id: 'fixture-pipeline' }
          )
        );
      } else {
        response.writeHead(404);
        response.end('{}');
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const context = await playwright.request.newContext({
      baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    });
    try {
      const table = new TableClass();
      table.entityResponseData = {
        id: 'fixture-table',
        name: 'table',
        fullyQualifiedName: 'service.database.schema.table',
        columns: [],
      };
      const { pipeline } = await table.createTestSuiteAndPipelines(
        context,
        undefined,
        scenario.interval
      );
      expect(pipeline.id, JSON.stringify(pipeline)).toBe('fixture-pipeline');
      expect(pipeline.airflowConfig).toEqual(scenario.expected);
      expect(pipeline.service).toEqual({
        id: 'fixture-suite',
        type: 'testSuite',
      });
    } finally {
      await context.dispose();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
}
