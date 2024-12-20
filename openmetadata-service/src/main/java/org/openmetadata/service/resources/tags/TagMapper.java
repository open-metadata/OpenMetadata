package org.openmetadata.service.resources.tags;

import static org.openmetadata.service.Entity.CLASSIFICATION;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.service.mapper.EntityMapper;

public class TagMapper implements EntityMapper<Tag, CreateTag> {
  @Override
  public Tag createToEntity(CreateTag create, String user) {
    return copy(new Tag(), create, user)
        .withStyle(create.getStyle())
        .withParent(getEntityReference(TAG, create.getParent()))
        .withClassification(getEntityReference(CLASSIFICATION, create.getClassification()))
        .withProvider(create.getProvider())
        .withMutuallyExclusive(create.getMutuallyExclusive());
  }
}
