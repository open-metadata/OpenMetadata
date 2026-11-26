package org.openmetadata.service.ontology;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import org.apache.jena.rdf.model.Model;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.service.rdf.OntologyReleaseProjection;
import org.openmetadata.service.rdf.OntologySparqlQueryService;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;

/**
 * Queries an ontology's working definitions through the same projection the sealed releases use,
 * so a draft answers exactly as it would once published. Nothing is written: the header and members
 * built here exist only for the length of the query.
 */
public final class OntologyDraftQuery {
  /** Reads the working definitions; see {@link OntologyWorkingSnapshot}. */
  @FunctionalInterface
  public interface Source {
    <T> T read(
        UUID ontologyId,
        Consumer<List<? extends OntologyDefinition>> authorize,
        Function<OntologyWorkingSnapshot.Snapshot, T> callback);
  }

  private final Source source;

  public OntologyDraftQuery(final Source source) {
    this.source = source;
  }

  public OntologySparqlQueryService.QueryResult query(
      final UUID id,
      final SparqlQuery request,
      final Consumer<List<? extends OntologyDefinition>> authorize) {
    return new OntologySparqlQueryService(
            (ontologyId, ignored) -> source.read(ontologyId, authorize, OntologyDraftQuery::model),
            new SparqlFederationGuard(null))
        .query(id, request);
  }

  private static Model model(final OntologyWorkingSnapshot.Snapshot working) {
    final var root = working.root();
    final UUID releaseId = UUID.randomUUID();
    final List<OntologyReleaseMember> members = new ArrayList<>();
    for (final var entry : working.entries()) {
      members.add(
          OntologyReleaseManifest.member(
                  releaseId,
                  entry.kind(),
                  entry.definition().getId(),
                  OntologyReleaseContent.project(entry.definition()))
              .withSourceVersion(entry.definition().getVersion()));
    }
    final OntologyRelease header =
        new OntologyRelease()
            .withId(releaseId)
            .withOntology(root.getEntityReference())
            .withOntologyIri(root.getIri())
            .withVersionIri(URI.create("urn:openmetadata:ontology-release:" + releaseId))
            .withSealedAt(System.currentTimeMillis())
            .withEncodingVersion(
                OntologyRelease.EncodingVersion.fromValue(OntologyReleaseManifest.ENCODING_VERSION))
            .withMemberCount(members.size())
            .withTotalBytes(
                members.stream().mapToLong(OntologyReleaseMember::getPayloadBytes).sum())
            .withContentDigest(OntologyReleaseManifest.digest(members));
    return new OntologyReleaseProjection().build(header, members);
  }
}
