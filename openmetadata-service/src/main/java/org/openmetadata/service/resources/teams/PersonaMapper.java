package org.openmetadata.service.resources.teams;

import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.EntityUtil;

public class PersonaMapper implements EntityMapper<Persona, CreatePersona> {
  @Override
  public Persona createToEntity(CreatePersona create, String user) {
    return copy(new Persona(), create, user)
        .withUsers(EntityUtil.toEntityReferences(create.getUsers(), Entity.USER))
        .withDefault(create.getDefault());
  }
}
