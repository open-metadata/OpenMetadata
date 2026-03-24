package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.Mockito;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

class SingleServerIndexingStrategyTest {

  @Test
  void delegatesExecutorOperations() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SearchRepository searchRepository = mock(SearchRepository.class);
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    ReindexingJobContext context = mock(ReindexingJobContext.class);
    ReindexingConfiguration config =
        ReindexingConfiguration.builder().entities(java.util.Set.of("table")).build();
    ExecutionResult result =
        new ExecutionResult(ExecutionResult.Status.COMPLETED, 10, 9, 1, 100, 200, new Stats());
    Stats stats = new Stats();

    try (MockedConstruction<SearchIndexExecutor> mocked =
        Mockito.mockConstruction(
            SearchIndexExecutor.class,
            (executor, mockContext) -> {
              when(executor.addListener(listener)).thenReturn(executor);
              when(executor.execute(config, context)).thenReturn(result);
              when(executor.getStats()).thenReturn(new AtomicReference<>(stats));
              when(executor.isStopped()).thenReturn(true);
            })) {
      SingleServerIndexingStrategy strategy =
          new SingleServerIndexingStrategy(collectionDAO, searchRepository);

      strategy.addListener(listener);
      assertSame(result, strategy.execute(config, context));
      assertEquals(Optional.of(stats), strategy.getStats());
      strategy.stop();
      assertTrue(strategy.isStopped());

      SearchIndexExecutor executor = mocked.constructed().get(0);
      verify(executor).addListener(listener);
      verify(executor).execute(config, context);
      verify(executor).getStats();
      verify(executor).stop();
      verify(executor).isStopped();
    }
  }

  @Test
  void getStatsHandlesMissingExecutorStats() {
    try (MockedConstruction<SearchIndexExecutor> mocked =
        Mockito.mockConstruction(
            SearchIndexExecutor.class,
            (executor, mockContext) ->
                when(executor.getStats()).thenReturn(new AtomicReference<>()))) {
      SingleServerIndexingStrategy strategy =
          new SingleServerIndexingStrategy(mock(CollectionDAO.class), mock(SearchRepository.class));

      assertEquals(Optional.empty(), strategy.getStats());
      assertFalse(strategy.isStopped());
    }
  }
}
