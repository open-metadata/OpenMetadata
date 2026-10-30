package org.openmetadata.service.resources.ontology;

import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public final class OntologyPropertyMapper
    implements EntityMapper<OntologyProperty, CreateOntologyProperty> {
  @Override
  public OntologyProperty createToEntity(final CreateOntologyProperty request, final String user) {
    return copy(new OntologyProperty(), request, user)
        .withOntology(
            Entity.getEntityReferenceByName(
                Entity.ONTOLOGY, request.getOntology(), Include.NON_DELETED))
        .withIri(request.getIri())
        .withKind(request.getKind())
        .withDomain(request.getDomain())
        .withRange(request.getRange())
        .withEnumValues(request.getEnumValues())
        .withUnit(request.getUnit())
        .withIsIdentifier(request.getIsIdentifier())
        .withInverse(request.getInverse())
        .withCharacteristics(request.getCharacteristics())
        .withPropertyChain(request.getPropertyChain())
        .withDisjointWith(request.getDisjointWith())
        .withDeprecated(request.getDeprecated())
        .withReplacedBy(request.getReplacedBy())
        .withProvider(request.getProvider());
  }
}
