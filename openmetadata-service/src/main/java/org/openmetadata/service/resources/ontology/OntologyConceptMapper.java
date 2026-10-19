package org.openmetadata.service.resources.ontology;

import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public final class OntologyConceptMapper
    implements EntityMapper<OntologyConcept, CreateOntologyConcept> {
  @Override
  public OntologyConcept createToEntity(final CreateOntologyConcept request, final String user) {
    return copy(new OntologyConcept(), request, user)
        .withOntology(
            Entity.getEntityReferenceByName(
                Entity.ONTOLOGY, request.getOntology(), Include.NON_DELETED))
        .withIri(request.getIri())
        .withConceptType(request.getConceptType())
        .withSynonyms(request.getSynonyms())
        .withConceptMappings(request.getConceptMappings())
        .withProvider(request.getProvider());
  }
}
