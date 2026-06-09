package org.openmetadata.service.migration.utils.v11211;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Tests the one-time pipeline task-FQN repair migration. The DB is mocked at the DAO boundary; the
 * real repair logic, JSON (de)serialization, and per-row resilience are exercised. Because this runs
 * during an upgrade, the key property is that a single bad row never aborts the migration.
 */
class MigrationUtilTest {

  // Legacy form: a task named a"b was stored with a backslash-escaped, unparseable FQN segment.
  private static final String CORRUPT_TASK_NAME = "a\"b";
  private static final String CORRUPT_TASK_FQN = "svc.pipeA.a\\\"b";
  private static final String REPAIRED_TASK_FQN = "svc.pipeA.\"a\"\"b\"";

  // Mirrors MigrationUtil.PAGE_SIZE (private); the repair loop pages the table in chunks of this.
  private static final int PAGE_SIZE = 1000;

  private CollectionDAO collectionDAO;
  private CollectionDAO.PipelineDAO pipelineDAO;

  @BeforeEach
  void setUp() {
    collectionDAO = mock(CollectionDAO.class);
    pipelineDAO = mock(CollectionDAO.PipelineDAO.class);
    when(collectionDAO.pipelineDAO()).thenReturn(pipelineDAO);
  }

  @Test
  void repairsUnparseableTaskFqnAndPersistsOnlyChangedPipelines() {
    givenPipelinePage(
        pipelineJson("svc.pipeA", task(CORRUPT_TASK_NAME, CORRUPT_TASK_FQN)),
        pipelineJson("svc.pipeB", task("t1", "svc.pipeB.t1")));

    MigrationUtil.repairPipelineTaskFqns(collectionDAO);

    ArgumentCaptor<Pipeline> captor = ArgumentCaptor.forClass(Pipeline.class);
    verify(pipelineDAO, times(1)).update(captor.capture());
    assertEquals(
        REPAIRED_TASK_FQN, captor.getValue().getTasks().getFirst().getFullyQualifiedName());
  }

  @Test
  void leavesValidTaskFqnsUntouched() {
    givenPipelinePage(
        pipelineJson("svc.pipeA", task("t1", "svc.pipeA.t1"), task("t2", "svc.pipeA.t2")));

    MigrationUtil.repairPipelineTaskFqns(collectionDAO);

    verify(pipelineDAO, never()).update(any());
  }

  @Test
  void repairsNullTaskFqnWithoutNpe() {
    givenPipelinePage(pipelineJson("svc.pipeA", task("t1", null)));

    assertDoesNotThrow(() -> MigrationUtil.repairPipelineTaskFqns(collectionDAO));

    ArgumentCaptor<Pipeline> captor = ArgumentCaptor.forClass(Pipeline.class);
    verify(pipelineDAO).update(captor.capture());
    assertEquals("svc.pipeA.t1", captor.getValue().getTasks().getFirst().getFullyQualifiedName());
  }

  @Test
  void doesNotAbortWhenARowIsUnreadableJson() {
    givenPipelinePage(
        pipelineJson("svc.pipeA", task(CORRUPT_TASK_NAME, CORRUPT_TASK_FQN)),
        "{ not valid pipeline json",
        pipelineJson("svc.pipeC", task("t", "svc.pipeC.t")));

    assertDoesNotThrow(() -> MigrationUtil.repairPipelineTaskFqns(collectionDAO));

    verify(pipelineDAO, times(1)).update(any());
  }

  @Test
  void doesNotAbortWhenUpdateThrows() {
    givenPipelinePage(
        pipelineJson("svc.pipeA", task(CORRUPT_TASK_NAME, CORRUPT_TASK_FQN)),
        pipelineJson("svc.pipeB", task("c\"d", "svc.pipeB.c\\\"d")));
    doThrow(new RuntimeException("db unavailable")).doNothing().when(pipelineDAO).update(any());

    assertDoesNotThrow(() -> MigrationUtil.repairPipelineTaskFqns(collectionDAO));

    verify(pipelineDAO, times(2)).update(any());
  }

  @Test
  void skipsPipelineWithNoTasks() {
    Pipeline pipeline =
        new Pipeline().withId(UUID.randomUUID()).withName("p").withFullyQualifiedName("svc.pipeA");
    givenPipelinePage(JsonUtils.pojoToJson(pipeline));

    MigrationUtil.repairPipelineTaskFqns(collectionDAO);

    verify(pipelineDAO, never()).update(any());
  }

  @Test
  void handlesEmptyPipelineTable() {
    when(pipelineDAO.listAfterWithOffset(anyInt(), anyInt())).thenReturn(List.of());

    assertDoesNotThrow(() -> MigrationUtil.repairPipelineTaskFqns(collectionDAO));

    verify(pipelineDAO, never()).update(any());
  }

  @Test
  void scansEveryPageAdvancingOffsetUntilAnEmptyPage() {
    String firstPage = pipelineJson("svc.pipeA", task(CORRUPT_TASK_NAME, CORRUPT_TASK_FQN));
    String secondPage = pipelineJson("svc.pipeZ", task(CORRUPT_TASK_NAME, CORRUPT_TASK_FQN));
    when(pipelineDAO.listAfterWithOffset(PAGE_SIZE, 0)).thenReturn(List.of(firstPage));
    when(pipelineDAO.listAfterWithOffset(PAGE_SIZE, PAGE_SIZE)).thenReturn(List.of(secondPage));
    when(pipelineDAO.listAfterWithOffset(PAGE_SIZE, 2 * PAGE_SIZE)).thenReturn(List.of());

    MigrationUtil.repairPipelineTaskFqns(collectionDAO);

    ArgumentCaptor<Pipeline> captor = ArgumentCaptor.forClass(Pipeline.class);
    verify(pipelineDAO, times(2)).update(captor.capture());
    assertEquals(
        List.of("svc.pipeA", "svc.pipeZ"),
        captor.getAllValues().stream().map(Pipeline::getFullyQualifiedName).toList());
    verify(pipelineDAO).listAfterWithOffset(PAGE_SIZE, PAGE_SIZE);
    verify(pipelineDAO).listAfterWithOffset(PAGE_SIZE, 2 * PAGE_SIZE);
  }

  private void givenPipelinePage(String... jsons) {
    when(pipelineDAO.listAfterWithOffset(anyInt(), anyInt()))
        .thenAnswer(inv -> (int) inv.getArgument(1) == 0 ? List.of(jsons) : List.of());
  }

  private String pipelineJson(String fqn, Task... tasks) {
    Pipeline pipeline =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("p")
            .withFullyQualifiedName(fqn)
            .withTasks(List.of(tasks));
    return JsonUtils.pojoToJson(pipeline);
  }

  private Task task(String name, String fullyQualifiedName) {
    return new Task().withName(name).withFullyQualifiedName(fullyQualifiedName);
  }
}
