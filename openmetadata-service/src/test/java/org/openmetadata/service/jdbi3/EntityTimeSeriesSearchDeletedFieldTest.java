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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.RETURNS_MOCKS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;

// The search listing's include filter and soft-delete propagation read this field from the
// entity's capability, so a time series that has its own deleted flag must keep declaring it.
class EntityTimeSeriesSearchDeletedFieldTest {

  @Test
  void aTimeSeriesWithItsOwnDeletedFlagDeclaresIt() {
    withRepositoriesBuilt(
        () ->
            assertEquals(
                Entity.FIELD_DELETED, new AgentExecutionRepository().getSearchDeletedField()));
  }

  @Test
  void aTimeSeriesWithoutADeletedFlagDeclaresNone() {
    withRepositoriesBuilt(() -> assertNull(new QueryCostRepository().getSearchDeletedField()));
  }

  @Test
  void anIncidentTakesItsTestCasesFlag() {
    withRepositoriesBuilt(
        () ->
            assertEquals(
                "testCase.deleted",
                new TestCaseResolutionStatusRepository().getSearchDeletedField()));
  }

  // Registration is stubbed so the repositories built here never replace the real ones in the
  // static maps other tests read.
  @SuppressWarnings("unchecked")
  private static void withRepositoriesBuilt(Runnable assertion) {
    CollectionDAO collection = mock(CollectionDAO.class, RETURNS_MOCKS);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entity.when(Entity::getCollectionDAO).thenReturn(collection);
      entity.when(Entity::getSearchRepository).thenReturn(null);
      entity
          .when(
              () ->
                  Entity.registerEntity(
                      any(Class.class), anyString(), any(EntityTimeSeriesRepository.class)))
          .thenAnswer(invocation -> null);
      assertion.run();
    }
  }
}
