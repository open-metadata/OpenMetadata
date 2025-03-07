package org.openmetadata.service.jobs;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.jobs.DeleteEntityArgs;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class DeleteEntityHandler implements BackgroundJobHandler {
  private final CollectionDAO daoCollection;

  public DeleteEntityHandler(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
  }

  @Override
  public void runJob(BackgroundJob job) throws BackgroundJobException {
    try {
      DeleteEntityArgs deleteEntityArgs =
          JsonUtils.convertValue(job.getJobArgs(), DeleteEntityArgs.class);
      LOG.debug("Starting DeleteEntityHandler job with args: {}", deleteEntityArgs);

      String entityType = deleteEntityArgs.getEntityType();
      EntityRepository<? extends EntityInterface> repository =
          Entity.getEntityRepository(entityType);
      repository.delete(
          deleteEntityArgs.getUpdatedBy(),
          deleteEntityArgs.getEntityId(),
          deleteEntityArgs.getRecursive(),
          deleteEntityArgs.getHardDelete());
      //      if (deleteEntityArgs.getHardDelete()) {
      //        limits.invalidateCache(entityType);
      //      }
      LOG.debug(
          "Completed DeleteEntityHandler job for entityId: {}", deleteEntityArgs.getEntityId());

    } catch (Exception e) {
      throw new BackgroundJobException(job.getId(), e.getMessage(), e);
    }
  }

  @Override
  public boolean sendStatusToWebSocket() {
    return true;
  }
}
