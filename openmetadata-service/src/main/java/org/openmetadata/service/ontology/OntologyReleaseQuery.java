package org.openmetadata.service.ontology;

import java.util.UUID;
import java.util.function.Consumer;
import org.apache.jena.rdf.model.Model;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.jdbi3.OntologyRepository;
import org.openmetadata.service.rdf.OntologyReleaseProjection;
import org.openmetadata.service.rdf.OntologySparqlQueryService;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;

/** Queries the active release's asserted graph, including while its asynchronous RDF write is pending. */
public final class OntologyReleaseQuery {
  private final OntologyRepository ontologies;
  private final OntologyReleaseRepository releases;

  public OntologyReleaseQuery(
      final OntologyRepository ontologies, final OntologyReleaseRepository releases) {
    this.ontologies = ontologies;
    this.releases = releases;
  }

  public OntologySparqlQueryService.QueryResult query(
      final UUID id, final SparqlQuery request, final Consumer<OntologyDefinition> authorize) {
    return new OntologySparqlQueryService(
            (ontologyId, ignored) -> activeModel(ontologyId, authorize),
            new SparqlFederationGuard(null))
        .query(id, request);
  }

  private Model activeModel(final UUID id, final Consumer<OntologyDefinition> authorize) {
    final UUID releaseId = ontologies.getState(id).getActiveReleaseId();
    if (releaseId == null) {
      throw new BadRequestException("Activate an approved ontology release before querying it");
    }
    final var release =
        releases.get(
            null, releaseId, releases.getFields("owners,reviewers"), Include.NON_DELETED, false);
    final var members =
        new OntologyReleaseReader(releases.getDaoCollection()).read(release, authorize);
    return new OntologyReleaseProjection().build(release, members);
  }
}
