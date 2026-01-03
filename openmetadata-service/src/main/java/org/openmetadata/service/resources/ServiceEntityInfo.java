package org.openmetadata.service.resources;

import lombok.Getter;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;

@Getter
public class ServiceEntityInfo<T extends EntityInterface> extends ResourceEntityInfo<T> {
  private final ServiceType serviceType;

  public ServiceEntityInfo(String entityType, ServiceType serviceType, Class<T> entityClass) {
    super(entityType, entityClass);
    this.serviceType = serviceType;
  }

  public ResourceEntityInfo<T> getResourceEntityInfo() {
    return new ResourceEntityInfo<>(this.entityType, this.entityClass);
  }
}
