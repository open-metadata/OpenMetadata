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
import { EntityTabs, EntityType } from '../../../../../enums/entity.enum';
import { TestSuite } from '../../../../../generated/tests/testSuite';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import observabilityRouterClassBase from '../../../../../utils/ObservabilityRouterClassBase';
import { getEntityDetailsPath } from '../../../../../utils/RouterUtils';
import { ProfilerTabPath } from '../../../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';

/**
 * Where a suite entry points, following the Test Suites list: a table suite is
 * shown as its table and opens the table's data quality tab, a bundle suite
 * opens its own page.
 */
export const getTestSuiteLink = (testSuite: TestSuite) =>
  testSuite.basic
    ? {
        name: getEntityName(testSuite.basicEntityReference),
        path: getEntityDetailsPath(
          EntityType.TABLE,
          testSuite.basicEntityReference?.fullyQualifiedName ?? '',
          EntityTabs.PROFILER,
          ProfilerTabPath.DATA_QUALITY
        ),
      }
    : {
        name: getEntityName(testSuite),
        path: observabilityRouterClassBase.getTestSuitePath(
          testSuite.fullyQualifiedName ?? testSuite.name
        ),
      };
