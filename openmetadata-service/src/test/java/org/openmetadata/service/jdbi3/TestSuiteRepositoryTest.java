package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.service.Entity;

class TestSuiteRepositoryTest {

  @Test
  void readsPersistedTestsRelationshipRevisions() {
    UUID firstId = UUID.randomUUID();
    UUID secondId = UUID.randomUUID();
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityExtensionDAO extensionDAO = mock(CollectionDAO.EntityExtensionDAO.class);
    when(collectionDAO.entityExtensionDAO()).thenReturn(extensionDAO);
    when(extensionDAO.getExtensionBatch(
            List.of(firstId.toString(), secondId.toString()),
            TestSuiteRepository.TESTS_REVISION_EXTENSION))
        .thenReturn(
            List.of(
                new CollectionDAO.ExtensionRecordWithId(
                    firstId, TestSuiteRepository.TESTS_REVISION_EXTENSION, "{\"revision\":5}"),
                new CollectionDAO.ExtensionRecordWithId(
                    secondId, TestSuiteRepository.TESTS_REVISION_EXTENSION, "{\"revision\":13}")));

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      assertEquals(
          Map.of(firstId, 5L, secondId, 13L),
          TestSuiteRepository.getTestsRelationshipRevisions(List.of(firstId, secondId)));
    }
  }
}
