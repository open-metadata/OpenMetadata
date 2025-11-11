package org.openmetadata.service.resources.glossary;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;
import static org.openmetadata.service.util.EntityUtil.getEntityReferenceByName;
import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class GlossaryTermMapper implements EntityMapper<GlossaryTerm, CreateGlossaryTerm> {
  @Override
  public GlossaryTerm createToEntity(CreateGlossaryTerm create, String user) {
    return copy(new GlossaryTerm(), create, user)
        .withSynonyms(create.getSynonyms())
        .withStyle(create.getStyle())
        .withGlossary(getEntityReferenceByName(Entity.GLOSSARY, create.getGlossary()))
        .withParent(getEntityReference(Entity.GLOSSARY_TERM, create.getParent()))
        .withRelatedTerms(getEntityReferences(Entity.GLOSSARY_TERM, create.getRelatedTerms()))
        .withReferences(create.getReferences())
        .withProvider(create.getProvider())
        .withMutuallyExclusive(create.getMutuallyExclusive());
  }
}
