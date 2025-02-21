package org.openmetadata.service.resources.glossary;

import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.service.mapper.EntityMapper;

public class GlossaryMapper implements EntityMapper<Glossary, CreateGlossary> {
  @Override
  public Glossary createToEntity(CreateGlossary create, String user) {
    return copy(new Glossary(), create, user)
        .withProvider(create.getProvider())
        .withMutuallyExclusive(create.getMutuallyExclusive());
  }
}
