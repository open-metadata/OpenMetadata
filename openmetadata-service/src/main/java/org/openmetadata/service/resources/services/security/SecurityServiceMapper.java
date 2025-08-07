package org.openmetadata.service.resources.services.security;

import org.openmetadata.schema.api.services.CreateSecurityService;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.service.mapper.EntityMapper;

public class SecurityServiceMapper implements EntityMapper<SecurityService, CreateSecurityService> {
  @Override
  public SecurityService createToEntity(CreateSecurityService create, String user) {
    return copy(new SecurityService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection());
  }
}
