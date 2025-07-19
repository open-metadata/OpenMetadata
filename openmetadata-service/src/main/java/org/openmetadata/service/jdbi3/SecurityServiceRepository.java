package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.SecurityConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.security.SecurityServiceResource;

public class SecurityServiceRepository
    extends ServiceEntityRepository<SecurityService, SecurityConnection> {
  public SecurityServiceRepository() {
    super(
        SecurityServiceResource.COLLECTION_PATH,
        Entity.SECURITY_SERVICE,
        Entity.getCollectionDAO().securityServiceDAO(),
        SecurityConnection.class,
        "",
        ServiceType.SECURITY);
    supportsSearch = true;
  }
} 