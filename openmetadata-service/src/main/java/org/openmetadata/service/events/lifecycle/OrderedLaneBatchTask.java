package org.openmetadata.service.events.lifecycle;

import java.util.List;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.events.lifecycle.OrderedLaneExecutor.OrderedTask;

/**
 * Ordered work for several entities of one lane, carrying each entity's locator so a failed or shed
 * task is retried for every one of them, as an {@link OrderedLaneTask} is for its one entity.
 */
public record OrderedLaneBatchTask(Runnable work, String operation, List<EntityReference> entities)
    implements OrderedTask {

  @Override
  public void run() {
    work.run();
  }
}
