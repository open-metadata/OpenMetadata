package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_STYLE;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

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
    applyServiceFields(doc, DocBuildContext.empty());
  }

  default void applyServiceFields(Map<String, Object> doc, DocBuildContext ctx) {
    Object entity = getEntity();
    if (entity instanceof EntityInterface ei) {
      EntityReference service = ei.getService();
      if (service != null) {
        EntityReference serviceWithDisplayName = getEntityWithDisplayName(service);
        Optional<Style> serviceStyle = ctx.prefetchedServiceStyle();
        if (serviceStyle == null) {
          serviceStyle = getServiceStyle(service);
        }
        if (serviceStyle.isPresent()) {
          Map<String, Object> serviceDoc = new HashMap<>(JsonUtils.getMap(serviceWithDisplayName));
          serviceDoc.put(FIELD_STYLE, serviceStyle.get());
          doc.put("service", serviceDoc);
        } else {
          doc.put("service", serviceWithDisplayName);
        }
      }
    }
    Object serviceType = getIndexServiceType();
    if (serviceType != null) {
      doc.put("serviceType", serviceType);
    }
  }

  default Optional<Style> getServiceStyle(EntityReference service) {
    if (service == null
        || service.getId() == null
        || nullOrEmpty(service.getType())
        || !Entity.entityHasField(service.getType(), FIELD_STYLE)) {
      return Optional.empty();
    }
    Optional<Style> cached = SERVICE_STYLE_CACHE.getIfPresent(service.getId());
    if (cached != null) {
      return cached;
    }
    try {
      ServiceEntityInterface serviceEntity = Entity.getEntity(service, FIELD_STYLE, Include.ALL);
      Optional<Style> style = Optional.ofNullable(serviceEntity.getStyle());
      SERVICE_STYLE_CACHE.put(service.getId(), style);
      return style;
    } catch (Exception e) {
      LOG.warn("Failed to fetch service style for service [{}]", service.getId(), e);
      return Optional.empty();
    }
  }
}
