package org.openmetadata.service.resources.domains;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;
import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import java.util.List;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.EntityUtil;

public class DomainMapper implements EntityMapper<Domain, CreateDomain> {
  @Override
  public Domain createToEntity(CreateDomain create, String user) {
    List<String> experts = create.getExperts();
    return copy(new Domain(), create, user)
        .withStyle(create.getStyle())
        .withDomainType(create.getDomainType())
        .withFullyQualifiedName(create.getName())
        .withParent(
            Entity.getEntityReference(
                getEntityReference(Entity.DOMAIN, create.getParent()), Include.NON_DELETED))
        .withExperts(
            EntityUtil.populateEntityReferences(getEntityReferences(Entity.USER, experts)));
  }
}
