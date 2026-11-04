package org.openmetadata.service.rdf;

import java.util.List;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.rdf.rebuild.RdfMutation;
import org.openmetadata.service.rdf.storage.RdfPayloadTooLargeException;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

/** A disposable projection of the current active pointer; working edits never reach this graph. */
public final class OntologyActiveGraph {
  public static final String GRAPH_PREFIX = "https://open-metadata.org/graph/ontology/";
  private static final int PAGE_SIZE = 100;
  private final CollectionDAO dao;

  public OntologyActiveGraph(final CollectionDAO dao) {
    this.dao = dao;
  }

  public void refresh(final UUID ontologyId, final RdfStorageInterface storage) {
    final Model model = currentModel(ontologyId);
    try {
      storage.replaceGraph(graph(ontologyId), model);
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

  private Model currentModel(final UUID ontologyId) {
    if (!isActive(ontologyId)) {
      return ModelFactory.createDefaultModel();
    }
    final var state = dao.ontologyStateDAO().get(ontologyId);
    final var release = dao.ontologyReleaseDAO().findEntityById(state.getActiveReleaseId());
    final var closure = new OntologyReleaseReader(dao).read(release, ignored -> {});
    return new OntologyReleaseProjection().build(release, closure);
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
    final Model model = new OntologyReleaseProjection().build(release, closure);
    try {
      RdfMutation.GraphReplace.capture(graph(release.getOntology().getId()), model);
    } catch (RdfPayloadTooLargeException tooLarge) {
      throw new BadRequestException(
          "Ontology RDF projection exceeds the 16 MiB rebuild journal limit");
    } finally {
      model.close();
    }
  }

  public static String graph(final UUID ontologyId) {
    return GRAPH_PREFIX + ontologyId;
  }
}
