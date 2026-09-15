package org.openmetadata.service.entity.delete;

import java.util.List;
import java.util.UUID;

/** Typed dispatch boundary for a registered entity family's hierarchy operations. */
public interface EntitySubtree {
  void bulkRestoreSubtree(List<UUID> ids, String updatedBy);

  void bulkSoftDeleteSubtree(List<UUID> ids, String updatedBy);

  void bulkHardDeleteSubtree(List<UUID> ids, String updatedBy);
}
