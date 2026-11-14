package org.openmetadata.service.rdf;

import java.io.OutputStream;
import java.util.List;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

/** A disposable projection of the current active pointer; working edits never reach this graph. */
public final class OntologyActiveGraph {
  public static final String GRAPH_PREFIX = "https://open-metadata.org/graph/ontology/";

  /**
   * The largest active graph, in RDF-Thrift bytes. Delivery sends it in requests of at most the
   * chunk size; this bounds the staging copy and the swap transaction instead. See
   * ADR:2026-10-15-fuseki-holds-only-the-active-ontology-release.
   */
  public static final long MAX_GRAPH_BYTES = 256L * 1024 * 1024;

  private static final int PAGE_SIZE = 100;
  private final CollectionDAO dao;

  public OntologyActiveGraph(final CollectionDAO dao) {
    this.dao = dao;
  }

  public void refresh(final UUID ontologyId, final RdfStorageInterface storage) {
    final UUID releaseId = activeRelease(ontologyId);
    final Model model = releaseModel(dao, releaseId);
    try {
      storage.replaceGraph(graph(ontologyId), releaseId, model);
    } finally {
      model.close();
    }
  }

  public void rebuild(final RdfStorageInterface storage) {
    String after = "";
    List<String> page;
    do {
      page = dao.ontologyStateDAO().listActive(after, PAGE_SIZE);
      page.forEach(id -> refreshDuringRebuild(UUID.fromString(id), storage));
      if (!page.isEmpty()) {
        after = page.getLast();
      }
    } while (page.size() == PAGE_SIZE);
    storage.getAllGraphs().stream()
        .filter(iri -> iri.startsWith(GRAPH_PREFIX))
        .map(iri -> UUID.fromString(iri.substring(GRAPH_PREFIX.length())))
        .filter(id -> !isActive(id))
        .forEach(id -> refreshDuringRebuild(id, storage));
  }

  private void refreshDuringRebuild(final UUID ontologyId, final RdfStorageInterface storage) {
    dao.useHandle(
        handle -> RdfLiveWriteStore.withWriterLock(handle, () -> refresh(ontologyId, storage)));
  }

  private UUID activeRelease(final UUID ontologyId) {
    return isActive(ontologyId)
        ? dao.ontologyStateDAO().get(ontologyId).getActiveReleaseId()
        : null;
  }

  /**
   * The served graph of a sealed release, or an empty graph for none. A release that no longer
   * exists went with its ontology's hard delete, whose own refresh empties the graph, so replaying
   * an older activation of it projects nothing.
   */
  public static Model releaseModel(final CollectionDAO dao, final UUID releaseId) {
    final var releases = dao.ontologyReleaseDAO();
    final String json =
        releaseId == null
            ? null
            : releases.findById(
                releases.getTableName(), releaseId, releases.getCondition(Include.ALL));
    return json == null
        ? ModelFactory.createDefaultModel()
        : project(dao, JsonUtils.readValue(json, OntologyRelease.class));
  }

  private static Model project(final CollectionDAO dao, final OntologyRelease release) {
    return project(release, new OntologyReleaseReader(dao).read(release, ignored -> {}));
  }

  /** The serving graph carries asserted statements only; their sources stay in SQL and exports. */
  private static Model project(
      final OntologyRelease release, final List<OntologyReleaseMember> closure) {
    return new OntologyReleaseProjection(OntologyReleaseProjection.StatementSources.OMITTED)
        .build(release, closure);
  }

  private boolean isActive(final UUID ontologyId) {
    final var roots = dao.ontologyEntityDAO();
    final String json =
        roots.findById(roots.getTableName(), ontologyId, roots.getCondition(Include.NON_DELETED));
    final var state = dao.ontologyStateDAO().get(ontologyId);
    return json != null && state != null && state.getActiveReleaseId() != null;
  }

  public static void requireProjectable(
      final OntologyRelease release, final List<OntologyReleaseMember> closure) {
    final Model model = project(release, closure);
    try {
      if (thriftBytes(model) > MAX_GRAPH_BYTES) {
        throw new BadRequestException(
            "Ontology RDF projection exceeds the "
                + MAX_GRAPH_BYTES / (1024 * 1024)
                + " MiB active graph limit");
      }
    } finally {
      model.close();
    }
  }

  private static long thriftBytes(final Model model) {
    final long[] count = {0};
    RDFDataMgr.write(
        new OutputStream() {
          @Override
          public void write(final int value) {
            count[0]++;
          }

          @Override
          public void write(final byte[] bytes, final int offset, final int length) {
            count[0] += length;
          }
        },
        model,
        RDFFormat.RDF_THRIFT);
    return count[0];
  }

  public static String graph(final UUID ontologyId) {
    return GRAPH_PREFIX + ontologyId;
  }
}
