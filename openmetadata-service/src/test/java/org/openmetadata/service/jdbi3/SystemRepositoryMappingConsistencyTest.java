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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.search.SearchConsumerFields;
import org.openmetadata.service.search.SearchRepository;

class SystemRepositoryMappingConsistencyTest {

  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private SearchRepository searchRepository;
  private SystemRepository systemRepository;

  @BeforeEach
  void setup() {
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);

    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SystemDAO systemDAO = mock(SystemDAO.class);
    when(collectionDAO.systemDAO()).thenReturn(systemDAO);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

    MigrationValidationClient migrationClient = mock(MigrationValidationClient.class);
    migrationMock.when(MigrationValidationClient::getInstance).thenReturn(migrationClient);

    searchRepository = mock(SearchRepository.class);
    entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

    systemRepository = new SystemRepository();
  }

  @AfterEach
  void tearDown() {
    entityMock.close();
    migrationMock.close();
  }

  @Test
  void testAllRequiredFieldsPresentReturnsEmpty() {
    IndexMapping dashboard = mock(IndexMapping.class);
    when(searchRepository.getEntityIndexMap()).thenReturn(Map.of("dashboard", dashboard));
    when(searchRepository.getIndexFieldNames(dashboard))
        .thenReturn(SearchConsumerFields.CANARY_REQUIRED_TOP_LEVEL_FIELDS);

    List<String> inconsistent =
        systemRepository.findIndexesWithMissingConsumerFields(searchRepository);

    assertTrue(inconsistent.isEmpty());
  }

  @Test
  void testMissingFieldIsReportedWithEntityAndField() {
    IndexMapping dashboard = mock(IndexMapping.class);
    Set<String> partial = new HashSet<>(SearchConsumerFields.CANARY_REQUIRED_TOP_LEVEL_FIELDS);
    partial.remove("tier");
    when(searchRepository.getEntityIndexMap()).thenReturn(Map.of("dashboard", dashboard));
    when(searchRepository.getIndexFieldNames(dashboard)).thenReturn(partial);

    List<String> inconsistent =
        systemRepository.findIndexesWithMissingConsumerFields(searchRepository);

    assertEquals(1, inconsistent.size());
    assertTrue(inconsistent.get(0).contains("dashboard"));
    assertTrue(inconsistent.get(0).contains("tier"));
  }

  @Test
  void testEmptyLiveFieldsSkippedSoMissingIndexIsNotDoubleReported() {
    IndexMapping dashboard = mock(IndexMapping.class);
    when(searchRepository.getEntityIndexMap()).thenReturn(Map.of("dashboard", dashboard));
    when(searchRepository.getIndexFieldNames(dashboard)).thenReturn(Set.of());

    List<String> inconsistent =
        systemRepository.findIndexesWithMissingConsumerFields(searchRepository);

    assertTrue(inconsistent.isEmpty());
  }

  @Test
  void testNonCanaryEntityIsIgnored() {
    IndexMapping tag = mock(IndexMapping.class);
    when(searchRepository.getEntityIndexMap()).thenReturn(Map.of("tag", tag));

    List<String> inconsistent =
        systemRepository.findIndexesWithMissingConsumerFields(searchRepository);

    assertTrue(inconsistent.isEmpty());
  }
}
