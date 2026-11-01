package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstance.WorkflowStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;

/**
 * A latest listing without a time range still asks the DAO for one row per partition: the
 * plain revision query would void the latest flag and paginate every revision of every record
 * instead, with a total that matches nothing it returns.
 */
class EntityTimeSeriesRepositoryLatestListTest {

  private static final ListFilter LATEST_FILTER = new ListFilter(Include.ALL);
  private static final int LIMIT = 10;

  private final EntityTimeSeriesDAO timeSeriesDao = mock(EntityTimeSeriesDAO.class);
  private MockedStatic<Entity> entity;
  private EntityTimeSeriesRepository<WorkflowInstance> repository;

  @BeforeEach
  void setUp() {
    entity = mockStatic(Entity.class);
    repository =
        new EntityTimeSeriesRepository<>(
            "governance.workflowInstances",
            timeSeriesDao,
            WorkflowInstance.class,
            Entity.WORKFLOW_INSTANCE) {};
  }

  @AfterEach
  void tearDown() {
    entity.close();
  }

  @Test
  void aLatestListingWithoutATimeRangeUsesThePartitionedQueryAndCount() {
    when(timeSeriesDao.listCount(LATEST_FILTER, true)).thenReturn(3);
    when(timeSeriesDao.listWithOffset(LATEST_FILTER, LIMIT, 0, true))
        .thenReturn(List.of(revisionJson(WorkflowStatus.FINISHED)));

    ResultList<WorkflowInstance> result =
        repository.listWithOffset(null, LATEST_FILTER, LIMIT, null, null, true, false);

    verify(timeSeriesDao).listWithOffset(LATEST_FILTER, LIMIT, 0, true);
    verify(timeSeriesDao, never()).listWithOffset(LATEST_FILTER, LIMIT, 0);
    assertEquals(WorkflowStatus.FINISHED, result.getData().getFirst().getStatus());
    assertEquals(3, result.getPaging().getTotal(), "total counts partitions, not revisions");
  }

  @Test
  void aListingWithoutATimeRangeWithoutLatestKeepsThePlainRevisionQuery() {
    when(timeSeriesDao.listCount(LATEST_FILTER, false)).thenReturn(3);
    when(timeSeriesDao.listWithOffset(LATEST_FILTER, LIMIT, 0, false))
        .thenReturn(List.of(revisionJson(WorkflowStatus.RUNNING)));

    ResultList<WorkflowInstance> result =
        repository.listWithOffset(null, LATEST_FILTER, LIMIT, null, null, false, false);

    verify(timeSeriesDao).listWithOffset(LATEST_FILTER, LIMIT, 0, false);
    assertEquals(WorkflowStatus.RUNNING, result.getData().getFirst().getStatus());
  }

  @Test
  void aLatestListingWithATimeRangeKeepsTheRangedPartitionedQuery() {
    when(timeSeriesDao.listCount(LATEST_FILTER, 1L, 2L, true)).thenReturn(3);
    when(timeSeriesDao.listWithOffset(LATEST_FILTER, LIMIT, 0, 1L, 2L, true))
        .thenReturn(List.of(revisionJson(WorkflowStatus.FINISHED)));

    repository.listWithOffset(null, LATEST_FILTER, LIMIT, 1L, 2L, true, false);

    verify(timeSeriesDao).listWithOffset(LATEST_FILTER, LIMIT, 0, 1L, 2L, true);
    verify(timeSeriesDao, never()).listWithOffset(LATEST_FILTER, LIMIT, 0);
  }

  @Test
  void withoutATimeRangeTheLatestDaoListingAndCountRouteToThePartitionedQueries() {
    EntityTimeSeriesDAO dao = mock(EntityTimeSeriesDAO.class, CALLS_REAL_METHODS);
    when(dao.getTimeSeriesTableName()).thenReturn("timeSeriesTable");
    when(dao.listWithOffset(
            anyString(), anyMap(), anyString(), eq("entityFQNHash"), eq(LIMIT), eq(0)))
        .thenReturn(List.of("latest"));
    when(dao.listCount(anyString(), eq("entityFQNHash"), anyMap(), anyString())).thenReturn(3);

    assertEquals(List.of("latest"), dao.listWithOffset(LATEST_FILTER, LIMIT, 0, true));
    assertEquals(3, dao.listCount(LATEST_FILTER, true));
  }

  @Test
  void withoutATimeRangeThePlainDaoListingAndCountStayUnpartitioned() {
    EntityTimeSeriesDAO dao = mock(EntityTimeSeriesDAO.class, CALLS_REAL_METHODS);
    when(dao.getTimeSeriesTableName()).thenReturn("timeSeriesTable");
    when(dao.listWithOffset(anyString(), anyMap(), anyString(), eq(LIMIT), eq(0)))
        .thenReturn(List.of("all"));
    when(dao.listCount(anyString(), anyMap(), anyString())).thenReturn(7);

    assertEquals(List.of("all"), dao.listWithOffset(LATEST_FILTER, LIMIT, 0, false));
    assertEquals(7, dao.listCount(LATEST_FILTER, false));
  }

  private static String revisionJson(WorkflowStatus status) {
    return JsonUtils.pojoToJson(
        new WorkflowInstance().withId(java.util.UUID.randomUUID()).withStatus(status));
  }
}
