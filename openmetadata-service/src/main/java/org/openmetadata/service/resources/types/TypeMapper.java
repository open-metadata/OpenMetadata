package org.openmetadata.service.resources.types;

import org.openmetadata.schema.api.CreateType;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.service.mapper.EntityMapper;

public class TypeMapper implements EntityMapper<Type, CreateType> {
  @Override
  public Type createToEntity(CreateType create, String user) {
    return copy(new Type(), create, user)
        .withFullyQualifiedName(create.getName())
        .withCategory(create.getCategory())
        .withSchema(create.getSchema());
  }
}
