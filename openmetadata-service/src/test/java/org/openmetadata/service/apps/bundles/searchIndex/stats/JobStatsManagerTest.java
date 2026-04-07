package org.openmetadata.service.apps.bundles.searchIndex.stats;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;

class JobStatsManagerTest {

  @Test
  void getTrackerReusesInstancesAndFlushesAllTrackedEntities() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.SearchIndexServerStatsDAO statsDAO =
        mock(CollectionDAO.SearchIndexServerStatsDAO.class);
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(statsDAO);

    JobStatsManager manager = new JobStatsManager("job", "server", collectionDAO);
    EntityStatsTracker tableTracker = manager.getTracker("table");
    EntityStatsTracker sameTableTracker = manager.getTracker("table");
    EntityStatsTracker userTracker = manager.getTracker("user");

    assertSame(tableTracker, sameTableTracker);
    assertEquals(2, manager.getTrackerCount());

    tableTracker.recordReader(StatsResult.SUCCESS);
    userTracker.recordSinkBatch(2, 1);

    manager.flushAll();

    verify(statsDAO)
        .incrementStats(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq("job"),
            org.mockito.ArgumentMatchers.eq("server"),
            org.mockito.ArgumentMatchers.eq("table"),
            org.mockito.ArgumentMatchers.eq(1L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0),
            org.mockito.ArgumentMatchers.eq(0),
            org.mockito.ArgumentMatchers.anyLong());
    verify(statsDAO)
        .incrementStats(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq("job"),
            org.mockito.ArgumentMatchers.eq("server"),
            org.mockito.ArgumentMatchers.eq("user"),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(2L),
            org.mockito.ArgumentMatchers.eq(1L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0L),
            org.mockito.ArgumentMatchers.eq(0),
            org.mockito.ArgumentMatchers.eq(0),
            org.mockito.ArgumentMatchers.anyLong());
  }

  @Test
  void returnsDaoBackedStatsAndDeletesTrackedState() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.SearchIndexServerStatsDAO statsDAO =
        mock(CollectionDAO.SearchIndexServerStatsDAO.class);
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(statsDAO);

    CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats aggregated =
        new CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats(
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11);
    List<CollectionDAO.SearchIndexServerStatsDAO.EntityStats> entityStats =
        List.of(
            new CollectionDAO.SearchIndexServerStatsDAO.EntityStats(
                "table", 1, 2, 3, 4, 5, 6, 7, 8, 9));
    when(statsDAO.getAggregatedStats("job")).thenReturn(aggregated);
    when(statsDAO.getStatsByEntityType("job")).thenReturn(entityStats);

    JobStatsManager manager = new JobStatsManager("job", "server", collectionDAO);
    manager.getTracker("table");

    assertSame(aggregated, manager.getJobStats());
    assertSame(entityStats, manager.getEntityStats());

    manager.deleteStats();

    verify(statsDAO).deleteByJobId("job");
    assertEquals(0, manager.getTrackerCount());
  }

  @Test
  void handlesMissingDaoGracefully() {
    JobStatsManager manager = new JobStatsManager("job", "server", null);

    assertNull(manager.getJobStats());
    assertEquals(List.of(), manager.getEntityStats());

    manager.deleteStats();

    assertEquals(0, manager.getTrackerCount());
  }
}
