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

import { Page } from '@playwright/test';
import { EntityClass } from '../../support/entity/EntityClass';
import { RightPanelTestSuite, TestOptions } from './RightPanelTestSuite';
import { PageContext } from '../PageObject/Explore/RightPanelPageObject';

export async function runRightPanelTestsForEntityDetailsPage(
  page: Page,
  entity: EntityClass,
  options?: TestOptions
): Promise<void> {
  const testSuite = new RightPanelTestSuite(
    page,
    entity,
    PageContext.ENTITY_DETAILS
  );

  await testSuite.runStandardTestSuite(options);
}

export async function runRightPanelTestsForLineagePage(
  page: Page,
  entity: EntityClass,
  options?: TestOptions
): Promise<void> {
  const testSuite = new RightPanelTestSuite(
    page,
    entity,
    PageContext.LINEAGE
  );

  const lineageOptions: TestOptions = {
    ...options,
    onlyTabs: ['lineage', 'overview'],
  };

  await testSuite.runStandardTestSuite(lineageOptions);
}

export async function runRightPanelTestsForExplorePage(
  page: Page,
  entity: EntityClass,
  options?: TestOptions
): Promise<void> {
  const testSuite = new RightPanelTestSuite(
    page,
    entity,
    PageContext.EXPLORE
  );

  await testSuite.runStandardTestSuite(options);
}

export async function runRightPanelTestsForServiceDetailsPage(
  page: Page,
  entity: EntityClass,
  options?: TestOptions
): Promise<void> {
  const testSuite = new RightPanelTestSuite(
    page,
    entity,
    PageContext.SERVICE_DETAILS
  );

  await testSuite.runStandardTestSuite(options);
}

export async function testRightPanelCRUDOperations(
  page: Page,
  entity: EntityClass,
  testData: {
    description?: string;
    ownerName?: string;
    tagName?: string;
    glossaryTermName?: string;
    tierName?: string;
    domainName?: string;
  },
  pageContext: PageContext = PageContext.EXPLORE
): Promise<void> {
  const testSuite = new RightPanelTestSuite(page, entity, pageContext);

  if (testData.description) {
    await testSuite.testDescriptionCRUD(testData.description);
  }

  if (testData.ownerName) {
    await testSuite.testOwnersCRUD(testData.ownerName);
  }

  if (testData.tagName) {
    await testSuite.testTagsCRUD(testData.tagName);
  }

  if (testData.glossaryTermName) {
    await testSuite.testGlossaryTermsCRUD(testData.glossaryTermName);
  }

  if (testData.tierName) {
    await testSuite.testTierCRUD(testData.tierName);
  }

  if (testData.domainName) {
    await testSuite.testDomainCRUD(testData.domainName);
  }
}

export async function verifyRightPanelEmptyStates(
  page: Page,
  entity: EntityClass,
  pageContext: PageContext = PageContext.EXPLORE
): Promise<void> {
  const testSuite = new RightPanelTestSuite(page, entity, pageContext);
  await testSuite.verifyEmptyStates();
}

export async function testRightPanelTabAvailability(
  page: Page,
  entity: EntityClass,
  expectedTabs: string[],
  pageContext: PageContext = PageContext.EXPLORE
): Promise<void> {
  const testSuite = new RightPanelTestSuite(page, entity, pageContext);
  await testSuite.verifyTabsAvailability(expectedTabs);
}

export function createRightPanelTestSuite(
  page: Page,
  entity: EntityClass,
  pageContext: PageContext = PageContext.EXPLORE
): RightPanelTestSuite {
  return new RightPanelTestSuite(page, entity, pageContext);
}
