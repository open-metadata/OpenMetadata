package org.openmetadata.service.resources.teams;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class RoleMapper implements EntityMapper<Role, CreateRole> {
  @Override
  public Role createToEntity(CreateRole create, String user) {
    if (nullOrEmpty(create.getPolicies())) {
      throw new IllegalArgumentException("At least one policy is required to create a role");
    }
    return copy(new Role(), create, user)
        .withPolicies(getEntityReferences(Entity.POLICY, create.getPolicies()));
  }
}
