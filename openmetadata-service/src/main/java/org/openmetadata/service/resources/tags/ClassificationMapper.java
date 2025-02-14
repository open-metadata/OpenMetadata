package org.openmetadata.service.resources.tags;

import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.service.mapper.EntityMapper;

public class ClassificationMapper implements EntityMapper<Classification, CreateClassification> {
  @Override
  public Classification createToEntity(CreateClassification create, String user) {
    return copy(new Classification(), create, user)
        .withFullyQualifiedName(create.getName())
        .withProvider(create.getProvider())
        .withMutuallyExclusive(create.getMutuallyExclusive());
  }
}
