package org.openmetadata.service.audit;

import java.util.function.UnaryOperator;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;

/** Applies the memory's reference projection to both the event and its stored entity image. */
@Slf4j
final class MemoryAuditProjection {
  private MemoryAuditProjection() {}

  static ChangeEvent apply(ChangeEvent event, UnaryOperator<ContextMemory> redaction) {
    ChangeEvent projected = null;
    if (event != null) {
      projected = JsonUtils.deepCopy(event, ChangeEvent.class);
      final ContextMemory changes =
          redaction.apply(
              new ContextMemory()
                  .withChangeDescription(projected.getChangeDescription())
                  .withIncrementalChangeDescription(projected.getIncrementalChangeDescription()));
      projected.setChangeDescription(changes.getChangeDescription());
      projected.setIncrementalChangeDescription(changes.getIncrementalChangeDescription());
      projected.setEntity(projectEntity(projected.getEntity(), redaction));
    }
    return projected;
  }

  private static Object projectEntity(Object entity, UnaryOperator<ContextMemory> redaction) {
    Object projected = null;
    if (entity != null) {
      try {
        final ContextMemory snapshot =
            entity instanceof String json
                ? JsonUtils.readValue(json, ContextMemory.class)
                : JsonUtils.convertValue(entity, ContextMemory.class);
        final ContextMemory visible = redaction.apply(snapshot);
        projected = entity instanceof String ? JsonUtils.pojoToJson(visible) : visible;
      } catch (JsonParsingException invalid) {
        LOG.debug("Cannot project an audit memory image: {}", invalid.getMessage());
      }
    }
    return projected;
  }
}
