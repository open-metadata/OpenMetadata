package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.JobExecutionContext;

class SearchIndexAppTest {

  @Test
  void executeAndStopDelegateToReindexingOrchestrator() throws Exception {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchIndexApp app = new SearchIndexApp(collectionDAO, searchRepository);
    App appEntity = mock(App.class);
    when(appEntity.getName()).thenReturn("SearchIndexing");
    setField(app, "app", appEntity);

    EventPublisherJob initialJob = new EventPublisherJob().withEntities(Set.of("table"));
    EventPublisherJob updatedJob = new EventPublisherJob().withEntities(Set.of("table", "user"));
    setField(app, "jobData", initialJob);

    try (MockedConstruction<ReindexingOrchestrator> mocked =
        Mockito.mockConstruction(
            ReindexingOrchestrator.class,
            (orchestrator, context) -> when(orchestrator.getJobData()).thenReturn(updatedJob))) {
      app.execute(mock(JobExecutionContext.class));

      ReindexingOrchestrator orchestrator = mocked.constructed().get(0);
      verify(orchestrator).run(initialJob);
      assertSame(updatedJob, app.getJobData());

      app.stop();

      verify(orchestrator).stop();
      assertSame(updatedJob, app.getJobData());
    }
  }

  @Test
  void stopWithoutOrchestratorIsANoopAndValidationRejectsInvalidConfig() {
    SearchIndexApp app =
        new SearchIndexApp(mock(CollectionDAO.class), mock(SearchRepository.class));

    app.stop();

    app.validateConfig(Map.of("entities", Set.of("table"), "batchSize", 100));

    AppException exception =
        assertThrows(
            AppException.class, () -> app.validateConfig(Map.of("batchSize", Map.of("bad", true))));
    assertNotNull(exception.getMessage());
  }

  @Test
  void reindexingExceptionConstructorsPreserveMessageAndCause() {
    SearchIndexApp.ReindexingException simple = new SearchIndexApp.ReindexingException("message");
    RuntimeException cause = new RuntimeException("boom");
    SearchIndexApp.ReindexingException wrapped =
        new SearchIndexApp.ReindexingException("wrapped", cause);

    assertEquals("message", simple.getMessage());
    assertEquals("wrapped", wrapped.getMessage());
    assertSame(cause, wrapped.getCause());
  }

  private void setField(Object target, String name, Object value) throws Exception {
    Field field = findField(target.getClass(), name);
    field.setAccessible(true);
    field.set(target, value);
  }

  private Field findField(Class<?> type, String name) throws NoSuchFieldException {
    Class<?> current = type;
    while (current != null) {
      try {
        return current.getDeclaredField(name);
      } catch (NoSuchFieldException ignored) {
        current = current.getSuperclass();
      }
    }
    throw new NoSuchFieldException(name);
  }
}
