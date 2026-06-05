package org.openmetadata.service.migration.utils.v11211;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Task;
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
 * the corrected value, so reads no longer pay a per-request repair and the corruption leaves the
 * stored data entirely.
 */
@Slf4j
public class MigrationUtil {

  private MigrationUtil() {}

  public static void repairPipelineTaskFqns(Handle handle, CollectionDAO collectionDAO) {
    List<String> pipelineIds =
        handle.createQuery("SELECT id FROM pipeline_entity").mapTo(String.class).list();
    int repairedTasks = 0;
    for (String pipelineId : pipelineIds) {
      repairedTasks += repairPipeline(collectionDAO, pipelineId);
    }
    LOG.info(
        "Pipeline task FQN repair complete: re-derived {} task FQNs across {} pipelines",
        repairedTasks,
        pipelineIds.size());
  }

  private static int repairPipeline(CollectionDAO collectionDAO, String pipelineId) {
    int repairedTasks = 0;
    try {
      Pipeline pipeline =
          collectionDAO.pipelineDAO().findEntityById(UUID.fromString(pipelineId), Include.ALL);
      repairedTasks = repairTasks(pipeline);
      if (repairedTasks > 0) {
        collectionDAO.pipelineDAO().update(pipeline);
      }
    } catch (Exception e) {
      LOG.warn("Skipping pipeline {} during task FQN repair: {}", pipelineId, e.getMessage());
    }
    return repairedTasks;
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
}
