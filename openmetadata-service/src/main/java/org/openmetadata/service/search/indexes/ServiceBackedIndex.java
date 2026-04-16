package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;

/**
 * Mixin interface for search indexes of entities backed by a service. Centralizes the service and
 * serviceType field population that was previously duplicated across 15+ index classes.
 *
 * <p>Implementations should override {@link #getIndexServiceType()} to provide the entity's service
 * type (e.g., {@code table.getServiceType()}), since {@code getServiceType()} is not on {@link
 * EntityInterface} and has different return types per entity.
 */
public interface ServiceBackedIndex extends SearchIndex {

  /**
   * Returns the service type for this entity. Override in implementations that have a serviceType
   * field. Returns null by default (serviceType will not be indexed).
   */
  default Object getIndexServiceType() {
    return null;
  }

  /**
   * Applies service-related fields to the search index document. Sets: service, serviceType (if
   * non-null).
   */
  default void applyServiceFields(Map<String, Object> doc) {
    Object entity = getEntity();
    if (entity instanceof EntityInterface ei) {
      EntityReference service = ei.getService();
      if (service != null) {
        doc.put("service", getEntityWithDisplayName(service));
      }
    }
    Object serviceType = getIndexServiceType();
    if (serviceType != null) {
      doc.put("serviceType", serviceType);
    }
  }
}
