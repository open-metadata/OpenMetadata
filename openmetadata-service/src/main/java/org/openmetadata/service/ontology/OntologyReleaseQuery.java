package org.openmetadata.service.ontology;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import org.apache.jena.query.ParameterizedSparqlString;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.vocabulary.OWL2;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.jdbi3.OntologyRepository;
import org.openmetadata.service.rdf.OntologyActiveGraph;
import org.openmetadata.service.rdf.OntologyReleaseProjection;
import org.openmetadata.service.rdf.OntologySparqlQueryService;
import org.openmetadata.service.rdf.OntologySparqlQueryService.ServedGraph;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard.QueryCapacityException;
import org.openmetadata.service.rdf.SparqlQueryLimits.OntologyTooLargeException;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;

/**
 * Queries the active release's asserted graph, including while its asynchronous RDF write is
 * pending. A release too large for the in-memory worker is answered from the graph the
 * triplestore serves, once that graph holds this release (ADR:2026-11-04-ontology-sparql-runs-in-a-bounded-worker).
 */
public final class OntologyReleaseQuery {
  public static final String GRAPH_LOADING_MESSAGE =
      "This ontology release is too large to query in memory, and the knowledge graph is still"
          + " loading it; retry shortly";

  /** Releases are immutable, so a size refusal holds for the release's lifetime. */
  private static final Cache<UUID, String> OVERSIZED_RELEASES =
      Caffeine.newBuilder().maximumSize(1_000).build();

  private final OntologyRepository ontologies;
  private final OntologyReleaseRepository releases;
  private final Supplier<RdfRepository> rdf;

  public OntologyReleaseQuery(
      final OntologyRepository ontologies,
      final OntologyReleaseRepository releases,
      final Supplier<RdfRepository> rdf) {
    this.ontologies = ontologies;
    this.releases = releases;
    this.rdf = rdf;
  }

  public OntologySparqlQueryService.QueryResult query(
      final UUID id,
      final SparqlQuery request,
      final Consumer<List<? extends OntologyDefinition>> authorize) {
    final long startedNanos = System.nanoTime();
    final OntologyRelease release = activeRelease(id);
    final OntologySparqlQueryService service =
        new OntologySparqlQueryService(
            (ontologyId, ignored) -> model(release, authorize), new SparqlFederationGuard(null));
    return answer(
        release.getId(),
        () -> service.query(id, request),
        () -> reader().read(release, authorize),
        tooLarge ->
            service.queryServedGraph(
                request, servedGraph(id, release, request, startedNanos, tooLarge), startedNanos));
  }

  /**
   * A release the worker already refused for its size skips the worker, and with it the
   * process-wide worker permit and the in-memory projection; its members are still authorized
   * first, so the served graph answers only a caller cleared to view the whole release.
   */
  static OntologySparqlQueryService.QueryResult answer(
      final UUID releaseId,
      final Supplier<OntologySparqlQueryService.QueryResult> inWorker,
      final Runnable authorizeMembers,
      final Function<OntologyTooLargeException, OntologySparqlQueryService.QueryResult>
          fromServedGraph) {
    final String refusal = OVERSIZED_RELEASES.getIfPresent(releaseId);
    if (refusal != null) {
      authorizeMembers.run();
      return fromServedGraph.apply(new OntologyTooLargeException(refusal));
    }
    try {
      return inWorker.get();
    } catch (OntologyTooLargeException tooLarge) {
      OVERSIZED_RELEASES.put(releaseId, tooLarge.getMessage());
      return fromServedGraph.apply(tooLarge);
    }
  }

  private ServedGraph servedGraph(
      final UUID id,
      final OntologyRelease release,
      final SparqlQuery request,
      final long startedNanos,
      final OntologyTooLargeException tooLarge) {
    final RdfRepository repository = rdf.get();
    if (repository == null || !repository.isEnabled()) {
      throw tooLarge;
    }
    final ServedGraph served = new ActiveGraph(OntologyActiveGraph.graph(id), repository);
    requireServes(
        served, release, OntologySparqlQueryService.remainingMillis(request, startedNanos));
    return served;
  }

  private static void requireServes(
      final ServedGraph served, final OntologyRelease release, final long timeoutMillis) {
    if (!servesRelease(served, release, timeoutMillis)) {
      throw new QueryCapacityException(GRAPH_LOADING_MESSAGE);
    }
  }

  /** The served graph names its release through the ontology's owl:versionIRI. */
  static boolean servesRelease(
      final ServedGraph served, final OntologyRelease release, final long timeoutMillis) {
    final ParameterizedSparqlString ask =
        new ParameterizedSparqlString("ASK { ?ontology ?versionIri ?version }");
    ask.setIri("ontology", release.getOntologyIri().toString());
    ask.setIri("versionIri", OWL2.versionIRI.getURI());
    ask.setIri("version", release.getVersionIri().toString());
    final Query query = OntologySparqlQueryService.scopedTo(ask.asQuery(), served.graphUri());
    final AtomicBoolean serves = new AtomicBoolean();
    served.read(query, timeoutMillis, execution -> serves.set(execution.execAsk()));
    return serves.get();
  }

  private OntologyRelease activeRelease(final UUID id) {
    final UUID releaseId = ontologies.getState(id).getActiveReleaseId();
    if (releaseId == null) {
      throw new BadRequestException("Activate an approved ontology release before querying it");
    }
    return releases.get(
        null, releaseId, releases.getFields("owners,reviewers"), Include.NON_DELETED, false);
  }

  private Model model(
      final OntologyRelease release, final Consumer<List<? extends OntologyDefinition>> authorize) {
    return new OntologyReleaseProjection().build(release, reader().read(release, authorize));
  }

  private OntologyReleaseReader reader() {
    return new OntologyReleaseReader(releases.getDaoCollection());
  }

  private record ActiveGraph(String graphUri, RdfRepository repository) implements ServedGraph {
    @Override
    public void read(
        final Query query, final long timeoutMillis, final Consumer<QueryExecution> reader) {
      repository.readQuery(query, timeoutMillis, reader);
    }
  }
}
