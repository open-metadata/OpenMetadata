package org.openmetadata.service.resources.ontology;

import org.openmetadata.schema.api.data.CreateOntology;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.service.mapper.EntityMapper;

public final class OntologyMapper implements EntityMapper<Ontology, CreateOntology> {
  @Override
  public Ontology createToEntity(final CreateOntology request, final String user) {
    return copy(new Ontology(), request, user)
        .withIri(request.getIri())
        .withNamespace(request.getNamespace())
        .withLayer(request.getLayer())
        .withPrefixes(request.getPrefixes())
        .withImports(request.getImports())
        .withProvider(request.getProvider());
  }
}
