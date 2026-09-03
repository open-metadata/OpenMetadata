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

import clickzettaConnection from '../../public/jsons/connectionSchemas/connections/database/clickzettaConnection.json';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import { getDatabaseConfig } from './DatabaseServicePureUtils';

// jest.mock() is hoisted above imports; require() inside the factory to avoid
// referencing top-level import bindings before they're initialized.
jest.mock('./loadConnectionSchema', () => {
  const schemas: Record<string, unknown> = {
    'connections/database/clickzettaConnection.json': require('../../public/jsons/connectionSchemas/connections/database/clickzettaConnection.json'),
  };

  return {
    loadConnectionSchema: jest.fn((relativePath: string) =>
      Promise.resolve(schemas[relativePath] ?? {})
    ),
  };
});

describe('DatabaseServicePureUtils', () => {
  it('loads the Clickzetta connection schema', async () => {
    const config = await getDatabaseConfig(DatabaseServiceType.Clickzetta);

    expect(config.schema).toEqual(clickzettaConnection);
  });
});
