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

import { DatabaseClass } from '../../../support/entity/DatabaseClass';
import { DatabaseServiceClass } from '../../../support/entity/service/DatabaseServiceClass';
import { test } from '../../../support/fixtures/base';
import { registerFilterSeparationSuite } from './SearchSeparationSuite';

test.use({ storageState: 'playwright/.auth/admin.json' });

registerFilterSeparationSuite({
  suiteName: 'Database',
  reindexEntityType: 'database',
  // The service facet only isolates this entity if it owns its service.
  entityFactory: () =>
    new DatabaseClass({ service: new DatabaseServiceClass() }),
});
