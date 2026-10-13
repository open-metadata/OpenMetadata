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

const clickzettaSchema = { title: 'ClickzettaConnection' };

jest.mock('./loadConnectionSchema', () => ({
  loadConnectionSchema: jest.fn(() => Promise.resolve(clickzettaSchema)),
}));

import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import { getDatabaseConfig } from './DatabaseServicePureUtils';
import { loadConnectionSchema } from './loadConnectionSchema';

describe('DatabaseServicePureUtils', () => {
  it('loads the Clickzetta connection schema', async () => {
    const config = await getDatabaseConfig(DatabaseServiceType.Clickzetta);

    expect(config.schema).toEqual(clickzettaSchema);
    expect(loadConnectionSchema).toHaveBeenCalledWith(
      'connections/database/clickzettaConnection.json'
    );
  });
});
