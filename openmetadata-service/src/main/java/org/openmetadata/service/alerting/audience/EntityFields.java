package org.openmetadata.service.alerting.audience;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;

/** What an entity type's schema holds, read from the class generated for it. */
final class EntityFields {

  private EntityFields() {}

  /**
   * False only for an entity type the server knows to have no such field: an unknown type is not
   * judged, so no recipient is lost to a type registered later.
   */
  static boolean mayHold(String entityType, String field) {
    Class<? extends EntityInterface<?>> type =
        entityType == null ? null : Entity.getEntityClassFromType(entityType);
    return type == null || Entity.getEntityFields(type).contains(field);
  }
}
