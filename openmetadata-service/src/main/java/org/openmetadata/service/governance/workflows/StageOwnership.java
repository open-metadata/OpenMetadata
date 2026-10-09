package org.openmetadata.service.governance.workflows;

import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.EntityInterface;

/** Which governance workflows own the lifecycle stage of an entity type, or of one entity. */
public interface StageOwnership {
  /** Names of the workflows that own the stage of entities of this type, sorted. */
  List<String> owningStageOf(String entityType);

  /** The workflow that owns this entity's stage, honouring each workflow's trigger filter. */
  Optional<String> owningStageOf(String entityType, EntityInterface<?> entity);
}
