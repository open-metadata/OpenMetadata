package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.NotFoundCache;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FreshReadScope;

/**
 * A read that bypasses the cache is answered by the database. A not-found marker can only be stale
 * there, so it must not answer; a read that uses the cache still takes its word.
 */
class EntityRepositoryUncachedReadTest {

  private CollectionDAO.PipelineDAO pipelineDAO;
  private PipelineRepo repo;
  private Pipeline stored;

  private static class PipelineRepo extends EntityRepository<Pipeline> {
    PipelineRepo(CollectionDAO.PipelineDAO dao) {
      super("pipelines", Entity.PIPELINE, Pipeline.class, dao, "", "");
    }

    @Override
    protected void setFields(Pipeline entity, Fields fields, RelationIncludes r) {}

    @Override
    protected void clearFields(Pipeline entity, Fields fields) {}

    @Override
    protected void prepare(Pipeline entity, boolean update) {}

    @Override
    protected void storeEntity(Pipeline entity, boolean update) {}

    @Override
    protected void storeRelationships(Pipeline entity) {}
  }

  @BeforeEach
  void setUp() {
    CollectionDAO daoCollection = mock(CollectionDAO.class);
    when(daoCollection.relationshipDAO())
        .thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    Entity.setCollectionDAO(daoCollection);
    pipelineDAO = mock(CollectionDAO.PipelineDAO.class);
    repo = new PipelineRepo(pipelineDAO);
    stored =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("uncached")
            .withFullyQualifiedName("service.uncached");
    when(pipelineDAO.findEntityById(stored.getId(), Include.NON_DELETED)).thenReturn(stored);
    when(pipelineDAO.findEntityByName(stored.getFullyQualifiedName(), Include.NON_DELETED))
        .thenReturn(stored);
  }

  @AfterEach
  void tearDown() {
    Entity.setCollectionDAO(null);
  }

  @Test
  void aNotFoundMarkerDoesNotAnswerAReadByIdThatBypassesTheCache() {
    NotFoundCache notFound = markingEverythingNotFound();
    try (MockedStatic<CacheBundle> cacheBundle = mockStatic(CacheBundle.class)) {
      cacheBundle.when(CacheBundle::getNotFoundCache).thenReturn(notFound);

      assertEquals(stored.getId(), repo.find(stored.getId(), Include.NON_DELETED, false).getId());

      verify(notFound, never()).isMarkedNotFoundById(any(), any());
    }
  }

  @Test
  void aNotFoundMarkerDoesNotAnswerAReadByNameThatBypassesTheCache() {
    NotFoundCache notFound = markingEverythingNotFound();
    try (MockedStatic<CacheBundle> cacheBundle = mockStatic(CacheBundle.class)) {
      cacheBundle.when(CacheBundle::getNotFoundCache).thenReturn(notFound);

      assertEquals(
          stored.getId(),
          repo.findByName(stored.getFullyQualifiedName(), Include.NON_DELETED, false).getId());

      verify(notFound, never()).isMarkedNotFoundByName(any(), any());
    }
  }

  @Test
  void aNotFoundMarkerDoesNotAnswerAReadInAFreshReadScope() {
    NotFoundCache notFound = markingEverythingNotFound();
    try (MockedStatic<CacheBundle> cacheBundle = mockStatic(CacheBundle.class);
        FreshReadScope.Handle ignored = FreshReadScope.enter()) {
      cacheBundle.when(CacheBundle::getNotFoundCache).thenReturn(notFound);

      assertEquals(stored.getId(), repo.find(stored.getId(), Include.NON_DELETED).getId());
    }
  }

  @Test
  void aNotFoundMarkerStillAnswersAReadThatUsesTheCache() {
    NotFoundCache notFound = markingEverythingNotFound();
    try (MockedStatic<CacheBundle> cacheBundle = mockStatic(CacheBundle.class)) {
      cacheBundle.when(CacheBundle::getNotFoundCache).thenReturn(notFound);

      assertThrows(
          EntityNotFoundException.class, () -> repo.find(stored.getId(), Include.NON_DELETED));

      verify(pipelineDAO, never()).findEntityById(any(), any());
    }
  }

  private static NotFoundCache markingEverythingNotFound() {
    NotFoundCache notFound = mock(NotFoundCache.class);
    when(notFound.enabled()).thenReturn(true);
    when(notFound.isMarkedNotFoundById(any(), any())).thenReturn(true);
    when(notFound.isMarkedNotFoundByName(any(), any())).thenReturn(true);
    return notFound;
  }
}
