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

/**
 * PR-side custom property suite for Dashboard. Runs Dashboard's full describe
 * block — BASIC/CONFIG CRUD plus the Dashboard-only advanced search describes
 * and search-config tests, which test Dashboard-specific custom property
 * behavior that isn't covered by the Table-only PR suite.
 *
 * Stress excludes Dashboard to avoid redundancy with this spec.
 */

import { test } from '@playwright/test';
import {
  ALL_ENTITIES,
  registerCustomPropertiesEntityTests,
} from '../../shared/customPropertiesEntityTests';

test.use({ storageState: 'playwright/.auth/admin.json' });

registerCustomPropertiesEntityTests(
  ALL_ENTITIES.filter((e) => e.key === 'entity_dashboard')
);
