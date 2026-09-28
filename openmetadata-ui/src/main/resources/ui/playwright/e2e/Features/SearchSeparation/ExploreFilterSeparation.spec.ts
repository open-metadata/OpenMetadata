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

/**
 * Live-indexing + SearchIndexApp reindex parity for Table. Both paths must produce the same
 * separation: Tier on tier.tagFQN, Certification on certification.tagLabel.tagFQN, classification
 * and glossary tags in tags[]. See {@link registerFilterSeparationSuite} for the shared logic;
 * sibling specs in this folder cover other entity types via the same factory.
 */

import { TableClass } from '../../../support/entity/TableClass';
import { test } from '../../../support/fixtures/base';
import { registerFilterSeparationSuite } from './SearchSeparationSuite';

test.use({ storageState: 'playwright/.auth/admin.json' });

registerFilterSeparationSuite({
  suiteName: 'Table',
  reindexEntityType: 'table',
  // Service-facet assertion pins to a single `table-data-card_<fqn>`;
  // under SharedInfra other workers' tables share the same service and
  // push the card past page 1. Use a unique service per suite so the
  // filter narrows to just this table.
  entityFactory: () =>
    new TableClass(undefined, undefined, undefined, {
      createFullHierarchy: true,
    }),
});
