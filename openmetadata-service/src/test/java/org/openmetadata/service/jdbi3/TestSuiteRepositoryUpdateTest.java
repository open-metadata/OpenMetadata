/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;

class TestSuiteRepositoryUpdateTest {
  private TestSuiteRepository repository;

  @BeforeEach
  void setUp() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.testSuiteDAO()).thenReturn(mock(CollectionDAO.TestSuiteDAO.class));
    Entity.setCollectionDAO(collectionDAO);
    repository = new TestSuiteRepository();
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void putWithoutTestsDoesNotRecordThemAsRemoved() {
    ChangeDescription change =
        changeFor(suiteWithOneTest(), suite(), EntityRepository.Operation.PUT);

    assertTrue(change.getFieldsDeleted().isEmpty());
    assertTrue(change.getFieldsUpdated().isEmpty());
  }

  @Test
  void putWithEmptyTestsStillRecordsTheChange() {
    ChangeDescription change =
        changeFor(suiteWithOneTest(), suite().withTests(List.of()), EntityRepository.Operation.PUT);

    assertEquals(
        List.of("tests"), change.getFieldsUpdated().stream().map(FieldChange::getName).toList());
  }

  private ChangeDescription changeFor(
      TestSuite original, TestSuite updated, EntityRepository.Operation operation) {
    TestSuiteRepository.TestSuiteUpdater updater =
        repository.new TestSuiteUpdater(original, updated, operation);
    updater.changeDescription = new ChangeDescription();
    updater.entitySpecificUpdate(false);
    return updater.changeDescription;
  }

  private TestSuite suiteWithOneTest() {
    return suite()
        .withTests(
            List.of(new EntityReference().withId(UUID.randomUUID()).withType(Entity.TEST_CASE)));
  }

  private TestSuite suite() {
    return new TestSuite()
        .withId(UUID.randomUUID())
        .withName("logical_suite")
        .withUpdatedBy("admin");
  }
}
