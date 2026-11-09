package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository.Operation;

@Isolated
class ContextFileRepositoryTest {
  private ContextFileRepository repository;

  @BeforeEach
  void setUp() {
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.contextFileDAO()).thenReturn(mock(CollectionDAO.ContextFileDAO.class));
    when(dao.contextFileContentDAO()).thenReturn(mock(CollectionDAO.ContextFileContentDAO.class));
    Entity.setCollectionDAO(dao);
    Jdbi jdbi = mock(Jdbi.class);
    when(jdbi.onDemand(CollectionDAO.class)).thenReturn(dao);
    repository = new ContextFileRepository(jdbi);
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @ParameterizedTest
  @EnumSource(
      value = Operation.class,
      names = {"PATCH", "PUT"})
  void updatesKeepStoredContentReferences(Operation operation) {
    ContextFile original = storedFile();
    ContextFile updated =
        JsonUtils.deepCopy(original, ContextFile.class)
            .withAssetId("another-asset")
            .withHeadContentId(UUID.randomUUID().toString())
            .withDescription("Updated description");

    repository.getUpdater(original, updated, operation, ChangeSource.MANUAL);

    assertEquals(original.getAssetId(), updated.getAssetId());
    assertEquals(original.getHeadContentId(), updated.getHeadContentId());
    assertEquals("Updated description", updated.getDescription());
  }

  @ParameterizedTest
  @EnumSource(
      value = Operation.class,
      names = {"PATCH", "PUT"})
  void updatesCannotClearStoredContentReferences(Operation operation) {
    ContextFile original = storedFile();
    ContextFile updated =
        new ContextFile()
            .withId(original.getId())
            .withName(original.getName())
            .withUpdatedBy(Entity.ADMIN_USER_NAME);

    repository.getUpdater(original, updated, operation, ChangeSource.MANUAL);

    assertEquals(original.getAssetId(), updated.getAssetId());
    assertEquals(original.getHeadContentId(), updated.getHeadContentId());
  }

  @ParameterizedTest
  @EnumSource(
      value = Operation.class,
      names = {"PATCH", "PUT"})
  void metadataOnlyFilesCannotAcquireContentReferences(Operation operation) {
    ContextFile original =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withName("notes")
            .withUpdatedBy(Entity.ADMIN_USER_NAME);
    ContextFile updated =
        JsonUtils.deepCopy(original, ContextFile.class)
            .withAssetId("another-asset")
            .withHeadContentId(UUID.randomUUID().toString());

    repository.getUpdater(original, updated, operation, ChangeSource.MANUAL);

    assertNull(updated.getAssetId());
    assertNull(updated.getHeadContentId());
  }

  private ContextFile storedFile() {
    return new ContextFile()
        .withId(UUID.randomUUID())
        .withName("report")
        .withUpdatedBy(Entity.ADMIN_USER_NAME)
        .withAssetId("stored-asset")
        .withHeadContentId(UUID.randomUUID().toString());
  }
}
