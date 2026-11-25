package org.openmetadata.service.ontology;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPage;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPageRequest;
import org.openmetadata.schema.api.data.NativeOntologyGraphPageSelection;
import org.openmetadata.schema.api.data.NativeOntologyGraphPageSelection.Kind;
import org.openmetadata.schema.api.data.NativeOntologyLoadedPrefix;
import org.openmetadata.schema.api.data.NativeOntologyTopologyPage;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.ConceptAssetCount;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.jdbi3.OntologyDAO.LineagePosition;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO.AxiomPosition;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO.EdgeAxiomRow;
import org.openmetadata.service.ontology.NativeOntologyDataGraphService.Cluster;
import org.openmetadata.service.ontology.NativeOntologyDataGraphService.Link;
import org.openmetadata.service.ontology.NativeOntologyDataGraphService.Target;
import org.openmetadata.service.ontology.NativeOntologyPrefixLineage.LineagePage;
import org.openmetadata.service.ontology.OntologyConceptBindingService.Access;
import org.openmetadata.service.util.FreshReadScope;

/** Serves one combined page: a cluster or binding selection plus topology over the loaded prefixes. */
public final class NativeOntologyDataGraphPager {
  private static final int MAX_CONCEPTS = 60;
  private static final int CANDIDATE_LIMIT = 500;
  private final NativeOntologyDataGraphService graph;
  private final CollectionDAO dao;
  private final OntologyConceptBindingStore store;
  private final OntologyConceptBindingService bindings;
  private final NativeOntologyTopologyCursorCodec codec;
  private final NativeOntologyPrefixLineage prefixLineage;

  public NativeOntologyDataGraphPager(
      final NativeOntologyDataGraphService graph,
      final CollectionDAO dao,
      final OntologyConceptBindingStore store,
      final OntologyConceptBindingService bindings,
      final NativeOntologyTopologyCursorCodec codec) {
    this.graph = graph;
    this.dao = dao;
    this.store = store;
    this.bindings = bindings;
    this.codec = codec;
    this.prefixLineage = new NativeOntologyPrefixLineage(dao, graph, CANDIDATE_LIMIT);
  }

  /** The caller's right to view the ontology itself is checked by the resource. */
  public NativeOntologyDataGraphPage page(
      final Access access,
      final UUID ontologyId,
      final NativeOntologyDataGraphPageRequest request) {
    validate(request);
    final var scope = new Scope(access, ontologyId, copyPrefixes(request.getLoaded()));
    final var resumed = resumed(scope, request.getPage());
    try (final var ignored = FreshReadScope.enter()) {
      final var response = new NativeOntologyDataGraphPage().withClusters(null);
      final var concepts = select(scope, request.getPage(), response);
      final var cursor = resumed.orElseGet(() -> Cursor.first(digest(ontologyId, scope.loaded())));
      response
          .withLoaded(scope.loaded())
          .withContextFull(scope.loaded().size() >= MAX_CONCEPTS)
          .withTopology(topology(scope, concepts, cursor));
      requireRevisions(scope.loaded());
      return response;
    }
  }

  private Map<UUID, OntologyConcept> select(
      final Scope scope,
      final NativeOntologyGraphPageSelection selection,
      final NativeOntologyDataGraphPage response) {
    final Map<UUID, OntologyConcept> concepts = new LinkedHashMap<>(validateContext(scope));
    switch (selection.getKind()) {
      case CLUSTERS -> concepts.putAll(clusters(scope, selection, response));
      case BINDINGS -> bindings(scope, selection, response);
      case TOPOLOGY -> {}
    }
    return concepts;
  }

  /** Opens a topology cursor before any read, so a refused token reveals nothing about the data. */
  private Optional<Cursor> resumed(final Scope scope, final NativeOntologyGraphPageSelection page) {
    return page.getKind() == Kind.TOPOLOGY
        ? Optional.of(codec.decode(page.getAfter(), digest(scope.ontologyId(), scope.loaded())))
        : Optional.empty();
  }

  private Map<UUID, OntologyConcept> clusters(
      final Scope scope,
      final NativeOntologyGraphPageSelection selection,
      final NativeOntologyDataGraphPage response) {
    final int limit = clusterLimit(selection.getLimit(), scope.loaded().size());
    final var ranked = ranked(scope.ontologyId(), limit, selection.getOffset());
    final var revisions =
        store.revisions(ranked.stream().map(ConceptAssetCount::conceptId).toList());
    final var clusters = unloaded(graph.clusters(scope.access(), ranked, 4), scope.loaded());
    final var added = load(clusters, revisions, scope.loaded());
    response
        .withClusters(clusters.stream().map(Cluster::response).toList())
        .withNextClusterOffset(
            nextClusterOffset(
                selection.getOffset(),
                limit,
                store.countBoundConcepts(scope.ontologyId()),
                scope.loaded().size()));
    return added;
  }

  private List<ConceptAssetCount> ranked(final UUID ontologyId, final int limit, final int offset) {
    return limit == 0 ? List.of() : store.boundConcepts(ontologyId, limit, offset);
  }

  private static Map<UUID, OntologyConcept> load(
      final List<Cluster> clusters,
      final Map<UUID, Long> revisions,
      final List<NativeOntologyLoadedPrefix> loaded) {
    final Map<UUID, OntologyConcept> added = new LinkedHashMap<>();
    for (final var cluster : clusters) {
      final UUID conceptId = cluster.concept().getId();
      added.put(conceptId, cluster.concept());
      loaded.add(prefix(cluster, revisions.get(conceptId)));
    }
    return added;
  }

  private static NativeOntologyLoadedPrefix prefix(final Cluster cluster, final Long revision) {
    final var preview = cluster.response();
    return new NativeOntologyLoadedPrefix()
        .withConceptId(cluster.concept().getId())
        .withBindingRevision(revision)
        .withThroughAssetId(
            through(
                null,
                preview.getAfter(),
                preview.getAssets().stream().map(asset -> asset.getAsset().getId()).toList()));
  }

  private void bindings(
      final Scope scope,
      final NativeOntologyGraphPageSelection selection,
      final NativeOntologyDataGraphPage response) {
    final var prefix = continuedPrefix(scope.loaded(), selection);
    final var page =
        bindings.get(
            scope.access(), prefix.getConceptId(), selection.getLimit(), selection.getAfter());
    if (!Objects.equals(page.getRevision(), prefix.getBindingRevision())) {
      throw changedBindings();
    }
    prefix.withThroughAssetId(
        through(
            prefix.getThroughAssetId(),
            page.getAfter(),
            page.getAssets().stream().map(asset -> asset.getAssetId()).toList()));
    response.withBindings(page);
  }

  private static NativeOntologyLoadedPrefix continuedPrefix(
      final List<NativeOntologyLoadedPrefix> loaded,
      final NativeOntologyGraphPageSelection selection) {
    final var prefix =
        loaded.stream()
            .filter(item -> item.getConceptId().equals(selection.getConceptId()))
            .findFirst()
            .orElseThrow(NativeOntologyDataGraphPager::invalidContext);
    if (!Objects.equals(
        prefix.getThroughAssetId(),
        OntologyConceptBindingService.decodeCursor(selection.getAfter()))) {
      throw invalidContext();
    }
    return prefix;
  }

  private Map<UUID, OntologyConcept> validateContext(final Scope scope) {
    final var ids = scope.loaded().stream().map(NativeOntologyLoadedPrefix::getConceptId).toList();
    final var concepts = graph.visibleConcepts(scope.access(), ids);
    requireLoadedConcepts(ids, concepts, scope.ontologyId());
    requireRevisions(scope.loaded());
    return concepts;
  }

  private void requireRevisions(final List<NativeOntologyLoadedPrefix> loaded) {
    final var current =
        store.revisions(loaded.stream().map(NativeOntologyLoadedPrefix::getConceptId).toList());
    if (loaded.stream()
        .anyMatch(
            prefix ->
                !Objects.equals(prefix.getBindingRevision(), current.get(prefix.getConceptId())))) {
      throw changedBindings();
    }
  }

  private NativeOntologyTopologyPage topology(
      final Scope scope, final Map<UUID, OntologyConcept> concepts, final Cursor cursor) {
    final var semantic = semantic(scope, conceptsByIri(concepts), cursor);
    final var lineage = lineage(scope, cursor);
    final var properties =
        graph.viewableProperties(scope.access(), scope.ontologyId(), semantic.links());
    return new NativeOntologyTopologyPage()
        .withContextDigest(cursor.contextDigest())
        .withEdges(
            semantic.links().stream()
                .map(link -> link.edge(properties.get(link.propertyIri().toString())))
                .toList())
        .withLineageEdges(lineage.edges())
        .withAfter(
            semantic.done() && lineage.done()
                ? null
                : codec.encode(cursor.next(semantic, lineage)));
  }

  private LineagePage lineage(final Scope scope, final Cursor cursor) {
    return cursor.lineageDone()
        ? LineagePage.done(cursor.lineageAfter())
        : prefixLineage.read(
            scope.access(), scope.ontologyId(), scope.loaded(), cursor.lineageAfter());
  }

  private static Map<String, UUID> conceptsByIri(final Map<UUID, OntologyConcept> concepts) {
    final Map<String, UUID> byIri = new LinkedHashMap<>();
    concepts
        .values()
        .forEach(concept -> byIri.putIfAbsent(concept.getIri().toString(), concept.getId()));
    return byIri;
  }

  private SemanticPage semantic(
      final Scope scope, final Map<String, UUID> concepts, final Cursor cursor) {
    if (cursor.semanticDone() || concepts.isEmpty()) {
      return new SemanticPage(Set.of(), cursor.semanticAfter(), 0, true);
    }
    final var hashes = concepts.keySet().stream().map(DigestUtils::sha256Hex).toList();
    final var position = semanticPosition(scope.ontologyId(), hashes, cursor.semanticAfter());
    final int limit = CANDIDATE_LIMIT - (position.hasAfter() ? 1 : 0);
    final var candidates =
        dao.ontologyReferenceDAO()
            .listPropertyEdgeAxioms(
                scope.ontologyId(), hashes, position, limit, cursor.targetOffset() > 0);
    final var visible = viewableAxioms(scope.access(), candidates);
    return semanticPage(candidates, visible, concepts, cursor, limit);
  }

  private Set<UUID> viewableAxioms(final Access access, final List<EdgeAxiomRow> candidates) {
    return graph.viewableIds(
        access,
        candidates.stream()
            .map(row -> new EntityReference().withId(row.id()).withType(Entity.ONTOLOGY_AXIOM))
            .toList());
  }

  private AxiomPosition semanticPosition(
      final UUID ontologyId, final List<String> hashes, final AxiomPosition after) {
    return after.hasAfter()
        ? requirePosition(
            dao.ontologyReferenceDAO()
                .findPropertyEdgeAxiomPosition(ontologyId, hashes, UUID.fromString(after.id())))
        : AxiomPosition.FIRST;
  }

  static SemanticPage semanticPage(
      final List<EdgeAxiomRow> candidates,
      final Set<UUID> visible,
      final Map<String, UUID> concepts,
      final Cursor cursor,
      final int candidateLimit) {
    final Set<Link> links = new LinkedHashSet<>();
    AxiomPosition after = cursor.semanticAfter();
    for (final var candidate : candidates) {
      final var stop =
          visible.contains(candidate.id())
              ? addLinks(candidate, cursor, concepts, links)
              : OptionalInt.empty();
      if (stop.isPresent()) {
        return new SemanticPage(links, candidate.position(), stop.getAsInt(), false);
      }
      after = candidate.position();
    }
    return new SemanticPage(links, after, 0, candidates.size() < candidateLimit);
  }

  /** Adds a visible axiom's links from the cursor's offset; the next offset when the page fills. */
  private static OptionalInt addLinks(
      final EdgeAxiomRow candidate,
      final Cursor cursor,
      final Map<String, UUID> concepts,
      final Set<Link> links) {
    final var axiom = JsonUtils.readValue(candidate.json(), OntologyAxiom.class);
    final var targets = NativeOntologyDataGraphService.targets(axiom);
    final UUID from = concepts.get(String.valueOf(axiom.getSubjectIri()));
    final int offset = startOffset(candidate, targets, cursor);
    for (int index = offset; from != null && index < targets.size(); index++) {
      final UUID to = concepts.get(targets.get(index).classIri().toString());
      if (to != null) {
        links.add(new Link(from, to, targets.get(index).propertyIri()));
      }
      if (links.size() == CANDIDATE_LIMIT) {
        return OptionalInt.of(index + 1 == targets.size() ? 0 : index + 1);
      }
    }
    return OptionalInt.empty();
  }

  private static int startOffset(
      final EdgeAxiomRow candidate, final List<Target> targets, final Cursor cursor) {
    final int offset =
        candidate.id().toString().equals(cursor.semanticAfter().id()) ? cursor.targetOffset() : 0;
    if (offset > targets.size()) {
      throw graphChanged();
    }
    return offset;
  }

  static Integer nextClusterOffset(
      final int offset, final int pageLimit, final int bound, final int loadedAfter) {
    final int next = offset + pageLimit;
    return loadedAfter < MAX_CONCEPTS && next < bound ? next : null;
  }

  static int clusterLimit(final int requested, final int loadedBefore) {
    return Math.min(requested, MAX_CONCEPTS - loadedBefore);
  }

  static List<Cluster> unloaded(
      final List<Cluster> clusters, final List<NativeOntologyLoadedPrefix> loaded) {
    final Set<UUID> ids =
        loaded.stream().map(NativeOntologyLoadedPrefix::getConceptId).collect(Collectors.toSet());
    return clusters.stream().filter(cluster -> !ids.contains(cluster.concept().getId())).toList();
  }

  static void requireLoadedConcepts(
      final List<UUID> ids, final Map<UUID, OntologyConcept> visible, final UUID ontologyId) {
    if (visible.size() != ids.size()) {
      throw graphChanged();
    }
    if (visible.values().stream()
        .anyMatch(concept -> !ontologyId.equals(concept.getOntology().getId()))) {
      throw invalidContext();
    }
  }

  static AxiomPosition requirePosition(final EdgeAxiomRow row) {
    if (row == null) {
      throw graphChanged();
    }
    return row.position();
  }

  static UUID through(final UUID previous, final String after, final List<UUID> assets) {
    return after != null
        ? OntologyConceptBindingService.decodeCursor(after)
        : assets.isEmpty() ? previous : assets.getLast();
  }

  static String digest(final UUID ontologyId, final List<NativeOntologyLoadedPrefix> loaded) {
    return DigestUtils.sha256Hex(
        ontologyId
            + "\n"
            + loaded.stream()
                .sorted(Comparator.comparing(prefix -> prefix.getConceptId().toString()))
                .map(
                    prefix ->
                        prefix.getConceptId()
                            + ":"
                            + prefix.getBindingRevision()
                            + ":"
                            + prefix.getThroughAssetId())
                .collect(Collectors.joining("\n")));
  }

  private static List<NativeOntologyLoadedPrefix> copyPrefixes(
      final List<NativeOntologyLoadedPrefix> loaded) {
    return loaded.stream()
        .map(
            prefix ->
                new NativeOntologyLoadedPrefix()
                    .withConceptId(prefix.getConceptId())
                    .withBindingRevision(prefix.getBindingRevision())
                    .withThroughAssetId(prefix.getThroughAssetId()))
        .collect(Collectors.toCollection(ArrayList::new));
  }

  static void validate(final NativeOntologyDataGraphPageRequest request) {
    if (request == null
        || request.getLoaded() == null
        || request.getLoaded().size() > MAX_CONCEPTS
        || request.getPage() == null
        || request.getPage().getKind() == null) {
      throw invalidContext();
    }
    validatePrefixes(request.getLoaded());
    validateSelection(request.getPage());
  }

  private static void validatePrefixes(final List<NativeOntologyLoadedPrefix> loaded) {
    final Set<UUID> concepts = new LinkedHashSet<>();
    for (final var prefix : loaded) {
      if (prefix == null
          || prefix.getConceptId() == null
          || prefix.getBindingRevision() == null
          || prefix.getBindingRevision() < 0
          || !concepts.add(prefix.getConceptId())) {
        throw invalidContext();
      }
    }
  }

  private static void validateSelection(final NativeOntologyGraphPageSelection page) {
    final boolean valid =
        switch (page.getKind()) {
          case CLUSTERS -> isClusterSelection(page);
          case BINDINGS -> page.getConceptId() != null
              && validLimit(page.getLimit(), 100)
              && page.getOffset() == null
              && validCursor(page.getAfter(), 256);
          case TOPOLOGY -> page.getConceptId() == null
              && page.getOffset() == null
              && page.getLimit() == null;
        };
    if (!valid) {
      throw invalidContext();
    }
  }

  private static boolean isClusterSelection(final NativeOntologyGraphPageSelection page) {
    return page.getOffset() != null
        && page.getOffset() >= 0
        && validLimit(page.getLimit(), 12)
        && page.getOffset() <= Integer.MAX_VALUE - page.getLimit()
        && page.getConceptId() == null
        && page.getAfter() == null;
  }

  private static boolean validLimit(final Integer limit, final int maximum) {
    return limit != null && limit > 0 && limit <= maximum;
  }

  private static boolean validCursor(final String after, final int maximum) {
    return after != null && !after.isBlank() && after.length() <= maximum;
  }

  private static BadRequestException invalidContext() {
    return new BadRequestException("Invalid native graph page context");
  }

  private static PreconditionFailedException changedBindings() {
    return new PreconditionFailedException("Concept bindings changed. Refresh the graph.");
  }

  private static PreconditionFailedException graphChanged() {
    return new PreconditionFailedException("The loaded graph changed. Refresh the graph.");
  }

  private record Scope(Access access, UUID ontologyId, List<NativeOntologyLoadedPrefix> loaded) {}

  record SemanticPage(Set<Link> links, AxiomPosition after, int targetOffset, boolean done) {}

  record Cursor(
      int version,
      String contextDigest,
      AxiomPosition semanticAfter,
      int targetOffset,
      LineagePosition lineageAfter,
      boolean semanticDone,
      boolean lineageDone) {
    static Cursor first(final String digest) {
      return new Cursor(1, digest, AxiomPosition.FIRST, 0, LineagePosition.FIRST, false, false);
    }

    Cursor next(final SemanticPage semantic, final LineagePage lineage) {
      return new Cursor(
          1,
          contextDigest,
          semantic.after(),
          semantic.targetOffset(),
          lineage.after(),
          semantic.done(),
          lineage.done());
    }
  }
}
