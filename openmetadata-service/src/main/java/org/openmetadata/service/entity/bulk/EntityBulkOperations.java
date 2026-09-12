package org.openmetadata.service.entity.bulk;

import java.util.Optional;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.api.BulkDeleteStaleRequest;
import org.openmetadata.schema.type.api.BulkOperationResult;

/** Bulk ingestion commands sharing the existing flush and job-admission boundaries. */
public interface EntityBulkOperations<T extends EntityInterface> {
  BulkOperationResult upsert(EntityBulkService.Request<T> request);

  EntityBulkJobs.Job submit(
      EntityBulkService.Request<T> request, EntityBulkJobs.Authorization authorization);

  Optional<BulkOperationResult> status(String id);

  BulkOperationResult deleteStale(BulkDeleteStaleRequest request, String actor);
}
