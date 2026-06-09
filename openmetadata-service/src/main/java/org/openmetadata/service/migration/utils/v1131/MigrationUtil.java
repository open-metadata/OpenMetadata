package org.openmetadata.service.migration.utils.v1131;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Repairs pipeline task FQNs that were persisted in an unparseable form before double-quote escaping
 * was supported in the FQN grammar.
 *
 * <p>Nested task FQNs are derived from the task {@code name} but are not hash-validated at insert
 * time, so a task whose name contained a {@code "} was stored with a corrupt segment that could not
 * be parsed or hashed, making later tag/owner reads fail with a 500. This one-time migration
 * re-derives any unparseable task FQN from its parent pipeline FQN and the task name and persists
 * the corrected value, so the corruption leaves the stored data and reads pay no per-request cost.
 *
 * <p>Pipelines are scanned in pages (no per-pipeline query), only changed rows are written, and any
 * pipeline that cannot be repaired is counted and sampled in the completion log so operators have a
 * concrete remediation list. Repaired FQNs reach the search index on the standard post-upgrade
 * reindex.
 */
@Slf4j
public class MigrationUtil {

  private static final int PAGE_SIZE = 1000;
  private static final int MAX_REPORTED_FAILURES = 100;

  private MigrationUtil() {}

  public static RepairSummary repairPipelineTaskFqns(CollectionDAO collectionDAO) {
    CollectionDAO.PipelineDAO pipelineDAO = collectionDAO.pipelineDAO();
    List<String> failedPipelineIds = new ArrayList<>();
    int scanned = 0;
    int repairedTasks = 0;
    int repairedPipelines = 0;
    int failedPipelines = 0;
    int offset = 0;
    List<String> page = pipelineDAO.listAfterWithOffset(PAGE_SIZE, offset);
    while (!page.isEmpty()) {
      for (String json : page) {
        scanned++;
        PipelineRepair repair = repairPipeline(pipelineDAO, json, failedPipelineIds);
        repairedTasks += repair.taskCount();
        repairedPipelines += repair.taskCount() > 0 ? 1 : 0;
        failedPipelines += repair.failed() ? 1 : 0;
      }
      offset += PAGE_SIZE;
      page = pipelineDAO.listAfterWithOffset(PAGE_SIZE, offset);
    }
    RepairSummary summary =
        new RepairSummary(scanned, repairedPipelines, repairedTasks, failedPipelines);
    logSummary(summary, failedPipelineIds);
    return summary;
  }

  private static PipelineRepair repairPipeline(
      CollectionDAO.PipelineDAO pipelineDAO, String json, List<String> failedPipelineIds) {
    int taskCount = 0;
    boolean failed = false;
    String pipelineId = null;
    try {
      Pipeline pipeline = JsonUtils.readValue(json, Pipeline.class);
      pipelineId = pipeline.getId().toString();
      taskCount = repairTasks(pipeline);
      if (taskCount > 0) {
        pipelineDAO.update(pipeline);
      }
    } catch (Exception e) {
      failed = true;
      // Persistence failed: nothing was written, so this row must not count as repaired.
      taskCount = 0;
      recordFailure(failedPipelineIds, pipelineId, e);
    }
    return new PipelineRepair(taskCount, failed);
  }

  private static int repairTasks(Pipeline pipeline) {
    String pipelineFqn = pipeline.getFullyQualifiedName();
    int repairedTasks = 0;
    for (Task task : listOrEmpty(pipeline.getTasks())) {
      if (!FullyQualifiedName.isValid(task.getFullyQualifiedName())) {
        task.setFullyQualifiedName(FullyQualifiedName.add(pipelineFqn, task.getName()));
        repairedTasks++;
      }
    }
    return repairedTasks;
  }

  private static void recordFailure(
      List<String> failedPipelineIds, String pipelineId, Exception e) {
    String id = nullOrEmpty(pipelineId) ? "<unreadable-pipeline-json>" : pipelineId;
    LOG.warn("Failed to repair task FQNs for pipeline {}: {}", id, e.getMessage());
    if (failedPipelineIds.size() < MAX_REPORTED_FAILURES) {
      failedPipelineIds.add(id);
    }
  }

  private static void logSummary(RepairSummary summary, List<String> failedPipelineIds) {
    LOG.info(
        "Pipeline task FQN repair complete: scanned {} pipelines, re-derived {} task FQNs across {} pipelines. "
            + "Repaired FQNs are reflected in search after the standard post-upgrade reindex.",
        summary.scanned(),
        summary.repairedTasks(),
        summary.repairedPipelines());
    if (summary.failedPipelines() > 0) {
      LOG.warn(
          "Pipeline task FQN repair could not fix {} pipeline(s); they retain unparseable task FQNs "
              + "and need manual remediation. First {} id(s): {}",
          summary.failedPipelines(),
          MAX_REPORTED_FAILURES,
          failedPipelineIds);
    }
  }

  private record PipelineRepair(int taskCount, boolean failed) {}

  public record RepairSummary(
      int scanned, int repairedPipelines, int repairedTasks, int failedPipelines) {}
}
