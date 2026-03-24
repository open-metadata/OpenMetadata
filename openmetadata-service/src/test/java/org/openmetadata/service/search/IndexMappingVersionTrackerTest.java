package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IndexMappingVersionDAO;

@ExtendWith(MockitoExtension.class)
class IndexMappingVersionTrackerTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private IndexMappingVersionDAO indexMappingVersionDAO;

  @Captor private ArgumentCaptor<String> hashCaptor;
  @Captor private ArgumentCaptor<String> jsonCaptor;

  @BeforeEach
  void setUp() {
    when(collectionDAO.indexMappingVersionDAO()).thenReturn(indexMappingVersionDAO);
  }

  @Test
  void updateMappingVersionsStoresOnlyMappedEntities() throws IOException {
    try (var entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getEntityList).thenReturn(Set.of("table", "missing_entity"));

      new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester").updateMappingVersions();

      verify(indexMappingVersionDAO)
          .upsertIndexMappingVersion(
              eq("table"),
              hashCaptor.capture(),
              jsonCaptor.capture(),
              eq("1.2.3"),
              anyLong(),
              eq("tester"));
      assertFalse(hashCaptor.getValue().isBlank());
      assertTrue(jsonCaptor.getValue().contains("\"en\""));
    }
  }

  @Test
  void getChangedMappingsReturnsOnlyEntitiesWithMissingOrChangedHashes() throws IOException {
    try (var entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getEntityList).thenReturn(Set.of("table", "missing_entity"));
      when(indexMappingVersionDAO.getAllMappingVersions())
          .thenReturn(
              List.of(new IndexMappingVersionDAO.IndexMappingVersion("table", "stale-hash")));

      List<String> changedMappings =
          new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester").getChangedMappings();

      assertEquals(List.of("table"), changedMappings);
    }
  }

  @Test
  void getChangedMappingsReturnsEmptyWhenStoredHashesMatchCurrentMappings() throws IOException {
    try (var entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getEntityList).thenReturn(Set.of("table"));
      IndexMappingVersionTracker tracker =
          new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester");

      tracker.updateMappingVersions();
      verify(indexMappingVersionDAO)
          .upsertIndexMappingVersion(
              eq("table"), hashCaptor.capture(), anyString(), eq("1.2.3"), anyLong(), eq("tester"));

      when(indexMappingVersionDAO.getAllMappingVersions())
          .thenReturn(
              List.of(
                  new IndexMappingVersionDAO.IndexMappingVersion("table", hashCaptor.getValue())));

      assertTrue(tracker.getChangedMappings().isEmpty());
    }
  }

  @Test
  void getChangedMappingsReturnsEmptyWhenNoMappingsExistForRequestedEntities() throws IOException {
    try (var entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getEntityList).thenReturn(Set.of("missing_entity"));

      assertTrue(
          new IndexMappingVersionTracker(collectionDAO, "1.2.3", "tester")
              .getChangedMappings()
              .isEmpty());
    }
  }
}
