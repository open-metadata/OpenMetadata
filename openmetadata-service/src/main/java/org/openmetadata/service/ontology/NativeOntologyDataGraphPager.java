package org.openmetadata.service.ontology;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPage;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPageRequest;
import org.openmetadata.schema.api.data.NativeOntologyGraphPageSelection;
import org.openmetadata.schema.api.data.NativeOntologyLoadedPrefix;
import org.openmetadata.schema.api.data.NativeOntologyTopologyPage;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.ConceptAssetCount;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.jdbi3.OntologyDAO.LineagePosition;
import org.openmetadata.service.jdbi3.OntologyDAO.PrefixFilter;
import org.openmetadata.service.jdbi3.OntologyDAO.PrefixLineageQuery;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO.AxiomPosition;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO.EdgeAxiomRow;
import org.openmetadata.service.ontology.NativeOntologyDataGraphService.Cluster;
import org.openmetadata.service.ontology.NativeOntologyDataGraphService.Link;
import org.openmetadata.service.ontology.OntologyConceptBindingService.Access;
import org.openmetadata.service.util.FreshReadScope;
import org.openmetadata.service.util.RestUtil;

final class NativeOntologyDataGraphPager {
  private static final int MAX_CONCEPTS = 60;
  private static final int CANDIDATE_LIMIT = 500;
  private static final int MAX_CURSOR_LENGTH = 8192;
  private final NativeOntologyDataGraphService graph;
  private final CollectionDAO dao;
  private final OntologyConceptBindingStore store;
  private final OntologyConceptBindingService bindings;

  NativeOntologyDataGraphPager(
      NativeOntologyDataGraphService graph,
      CollectionDAO dao,
      OntologyConceptBindingStore store,
      OntologyConceptBindingService bindings) {
    this.graph = graph;
    this.dao = dao;
    this.store = store;
    this.bindings = bindings;
  }

  NativeOntologyDataGraphPage page(
      Access access, UUID ontologyId, NativeOntologyDataGraphPageRequest request) {
    validate(request);
    try (final var ignored = FreshReadScope.enter()) {
      final var loaded = copyPrefixes(request.getLoaded());
      final Map<UUID, OntologyConcept> concepts =
          new LinkedHashMap<>(validateContext(access, ontologyId, loaded));
      final var response = new NativeOntologyDataGraphPage().withClusters(null);
      switch (request.getPage().getKind()) {
        case CLUSTERS -> concepts.putAll(
            clusters(access, ontologyId, request.getPage(), loaded, response));
        case BINDINGS -> bindings(access, request.getPage(), loaded, response);
        case TOPOLOGY -> {}
      }
      final String digest = digest(ontologyId, loaded);
      final Cursor cursor =
          request.getPage().getKind() == NativeOntologyGraphPageSelection.Kind.TOPOLOGY
              ? Cursor.decode(request.getPage().getAfter(), digest)
              : Cursor.first(digest);
      response
          .withLoaded(loaded)
          .withContextFull(loaded.size() >= MAX_CONCEPTS)
          .withTopology(topology(access, ontologyId, loaded, concepts, cursor));
      requireRevisions(loaded);
      return response;
    }
  }

  private Map<UUID, OntologyConcept> clusters(
      Access access,
      UUID ontologyId,
      NativeOntologyGraphPageSelection selection,
      List<NativeOntologyLoadedPrefix> loaded,
      NativeOntologyDataGraphPage response) {
    final int limit = clusterLimit(selection.getLimit(), loaded.size());
    final var ranked =
        limit == 0
            ? List.<ConceptAssetCount>of()
            : store.boundConcepts(ontologyId, limit, selection.getOffset());
    final var revisions = store.revisions(ranked.stream().map(count -> count.conceptId()).toList());
    final var clusters = unloaded(graph.clusters(access, ranked, 4), loaded);
    final Map<UUID, OntologyConcept> added = new LinkedHashMap<>();
    for (final var cluster : clusters) {
      final UUID conceptId = cluster.concept().getId();
      added.put(conceptId, cluster.concept());
      loaded.add(
          new NativeOntologyLoadedPrefix()
              .withConceptId(conceptId)
              .withBindingRevision(revisions.get(conceptId))
              .withThroughAssetId(
                  through(
                      null,
                      cluster.response().getAfter(),
                      cluster.response().getAssets().stream()
                          .map(asset -> asset.getAsset().getId())
                          .toList())));
    }
    response.withClusters(clusters.stream().map(cluster -> cluster.response()).toList());
    final var next =
        nextClusterOffset(
            selection.getOffset(), limit, store.countBoundConcepts(ontologyId), loaded.size());
    if (next != null) {
      response.withNextClusterOffset(next);
    }
    return added;
  }

  private void bindings(
      Access access,
      NativeOntologyGraphPageSelection selection,
      List<NativeOntologyLoadedPrefix> loaded,
      NativeOntologyDataGraphPage response) {
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
    final var page =
        bindings.get(access, prefix.getConceptId(), selection.getLimit(), selection.getAfter());
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

  private Map<UUID, OntologyConcept> validateContext(
      Access access, UUID ontologyId, List<NativeOntologyLoadedPrefix> loaded) {
    final var ids = loaded.stream().map(NativeOntologyLoadedPrefix::getConceptId).toList();
    final var concepts = graph.visibleConcepts(access, ids);
    requireLoadedConcepts(ids, concepts, ontologyId);
    requireRevisions(loaded);
    return concepts;
  }

  private void requireRevisions(List<NativeOntologyLoadedPrefix> loaded) {
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
      Access access,
      UUID ontologyId,
      List<NativeOntologyLoadedPrefix> loaded,
      Map<UUID, OntologyConcept> concepts,
      Cursor cursor) {
    final var conceptsByIri = new LinkedHashMap<String, UUID>();
    concepts
        .values()
        .forEach(
            concept -> conceptsByIri.putIfAbsent(concept.getIri().toString(), concept.getId()));
    final var semantic = semantic(access, ontologyId, conceptsByIri, cursor);
    final var lineage = lineage(access, ontologyId, loaded, cursor);
    final var properties = graph.viewableProperties(access, ontologyId, semantic.links());
    final var next =
        new Cursor(
            1,
            cursor.contextDigest(),
            semantic.after(),
            semantic.targetOffset(),
            lineage.after(),
            semantic.done(),
            lineage.done());
    return new NativeOntologyTopologyPage()
        .withContextDigest(cursor.contextDigest())
        .withEdges(
            semantic.links().stream()
                .map(link -> link.edge(properties.get(link.propertyIri().toString())))
                .toList())
        .withLineageEdges(lineage.edges())
        .withAfter(next.semanticDone() && next.lineageDone() ? null : next.encode());
  }

  private SemanticPage semantic(
      Access access, UUID ontologyId, Map<String, UUID> concepts, Cursor cursor) {
    if (cursor.semanticDone() || concepts.isEmpty()) {
      return new SemanticPage(Set.of(), cursor.semanticAfter(), 0, true);
    }
    final var hashes = concepts.keySet().stream().map(DigestUtils::sha256Hex).toList();
    final var position = semanticPosition(ontologyId, hashes, cursor.semanticAfter());
    final int limit = CANDIDATE_LIMIT - (position.hasAfter() ? 1 : 0);
    final var candidates =
        dao.ontologyReferenceDAO()
            .listPropertyEdgeAxioms(ontologyId, hashes, position, limit, cursor.targetOffset() > 0);
    final var visible =
        graph.viewableIds(
            access,
            candidates.stream()
                .map(row -> new EntityReference().withId(row.id()).withType(Entity.ONTOLOGY_AXIOM))
                .toList());
    return semanticPage(candidates, visible, concepts, cursor, limit);
  }

  private AxiomPosition semanticPosition(
      UUID ontologyId, List<String> hashes, AxiomPosition after) {
    if (!after.hasAfter()) {
      return AxiomPosition.FIRST;
    }
    return requirePosition(
        dao.ontologyReferenceDAO()
            .findPropertyEdgeAxiomPosition(ontologyId, hashes, UUID.fromString(after.id())));
  }

  static SemanticPage semanticPage(
      List<EdgeAxiomRow> candidates,
      Set<UUID> visible,
      Map<String, UUID> concepts,
      Cursor cursor,
      int candidateLimit) {
    final Set<Link> links = new LinkedHashSet<>();
    AxiomPosition after = cursor.semanticAfter();
    int offset = cursor.targetOffset();
    for (final var candidate : candidates) {
      if (offset > 0 && !candidate.id().toString().equals(cursor.semanticAfter().id())) {
        offset = 0;
      }
      final var axiom = JsonUtils.readValue(candidate.json(), OntologyAxiom.class);
      final var targets = NativeOntologyDataGraphService.targets(axiom);
      if (offset > targets.size()) {
        throw invalidCursor();
      }
      final UUID from = concepts.get(String.valueOf(axiom.getSubjectIri()));
      for (int index = offset;
          visible.contains(candidate.id()) && from != null && index < targets.size();
          index++) {
        final var target = targets.get(index);
        final UUID to = concepts.get(target.classIri().toString());
        if (to != null) {
          links.add(new Link(from, to, target.propertyIri()));
        }
        if (links.size() == CANDIDATE_LIMIT) {
          final boolean finished = index + 1 == targets.size();
          return new SemanticPage(links, candidate.position(), finished ? 0 : index + 1, false);
        }
      }
      offset = 0;
      after = candidate.position();
    }
    return new SemanticPage(links, after, 0, candidates.size() < candidateLimit);
  }

  private LineagePage lineage(
      Access access, UUID ontologyId, List<NativeOntologyLoadedPrefix> loaded, Cursor cursor) {
    final var filter = PrefixFilter.of(loaded);
    if (cursor.lineageDone() || filter.bindings().isEmpty()) {
      return new LineagePage(List.of(), cursor.lineageAfter(), true);
    }
    final var candidates =
        dao.ontologyDAO()
            .listLineageForPrefixes(
                filter.predicate("source"),
                filter.predicate("target"),
                filter.bindings(),
                new PrefixLineageQuery(
                    ontologyId.toString(), cursor.lineageAfter(), CANDIDATE_LIMIT));
    final List<BindingRow> endpoints = new ArrayList<>();
    for (final var row : candidates) {
      endpoints.add(endpoint(row.fromId(), row.fromEntity()));
      endpoints.add(endpoint(row.toId(), row.toEntity()));
    }
    final var visible = graph.visibleAssets(access, endpoints).keySet();
    final var edges =
        candidates.stream()
            .filter(
                row ->
                    visible.contains(UUID.fromString(row.fromId()))
                        && visible.contains(UUID.fromString(row.toId())))
            .map(
                row ->
                    new Edge()
                        .withFromEntity(UUID.fromString(row.fromId()))
                        .withToEntity(UUID.fromString(row.toId())))
            .distinct()
            .toList();
    return new LineagePage(
        edges,
        candidates.isEmpty() ? cursor.lineageAfter() : candidates.getLast().position(),
        candidates.size() < CANDIDATE_LIMIT);
  }

  private static BindingRow endpoint(String id, String type) {
    return new BindingRow(
        null, UUID.fromString(id), OntologyBindingAssetType.fromValue(type), null, List.of());
  }

  static Integer nextClusterOffset(int offset, int pageLimit, int bound, int loadedAfter) {
    final int next = offset + pageLimit;
    return loadedAfter < MAX_CONCEPTS && next < bound ? next : null;
  }

  static int clusterLimit(int requested, int loadedBefore) {
    return Math.min(requested, MAX_CONCEPTS - loadedBefore);
  }

  static List<Cluster> unloaded(List<Cluster> clusters, List<NativeOntologyLoadedPrefix> loaded) {
    final Set<UUID> ids =
        loaded.stream().map(NativeOntologyLoadedPrefix::getConceptId).collect(Collectors.toSet());
    return clusters.stream().filter(cluster -> !ids.contains(cluster.concept().getId())).toList();
  }

  static void requireLoadedConcepts(
      List<UUID> ids, Map<UUID, OntologyConcept> visible, UUID ontologyId) {
    if (visible.size() != ids.size()) {
      throw graphChanged();
    }
    if (visible.values().stream()
        .anyMatch(concept -> !ontologyId.equals(concept.getOntology().getId()))) {
      throw invalidContext();
    }
  }

  static AxiomPosition requirePosition(EdgeAxiomRow row) {
    if (row == null) {
      throw graphChanged();
    }
    return row.position();
  }

  static UUID through(UUID previous, String after, List<UUID> assets) {
    return after != null
        ? OntologyConceptBindingService.decodeCursor(after)
        : assets.isEmpty() ? previous : assets.getLast();
  }

  static String digest(UUID ontologyId, List<NativeOntologyLoadedPrefix> loaded) {
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
      List<NativeOntologyLoadedPrefix> loaded) {
    return loaded.stream()
        .map(
            prefix ->
                new NativeOntologyLoadedPrefix()
                    .withConceptId(prefix.getConceptId())
                    .withBindingRevision(prefix.getBindingRevision())
                    .withThroughAssetId(prefix.getThroughAssetId()))
        .collect(Collectors.toCollection(ArrayList::new));
  }

  static void validate(NativeOntologyDataGraphPageRequest request) {
    if (request == null
        || request.getLoaded() == null
        || request.getLoaded().size() > MAX_CONCEPTS
        || request.getPage() == null
        || request.getPage().getKind() == null) {
      throw invalidContext();
    }
    final Set<UUID> concepts = new LinkedHashSet<>();
    for (final var prefix : request.getLoaded()) {
      if (prefix == null
          || prefix.getConceptId() == null
          || prefix.getBindingRevision() == null
          || prefix.getBindingRevision() < 0
          || !concepts.add(prefix.getConceptId())) {
        throw invalidContext();
      }
    }
    validateSelection(request.getPage());
  }

  private static void validateSelection(NativeOntologyGraphPageSelection page) {
    final boolean valid =
        switch (page.getKind()) {
          case CLUSTERS -> page.getOffset() != null
              && page.getOffset() >= 0
              && validLimit(page.getLimit(), 12)
              && page.getOffset() <= Integer.MAX_VALUE - page.getLimit()
              && page.getConceptId() == null
              && page.getAfter() == null;
          case BINDINGS -> page.getConceptId() != null
              && validLimit(page.getLimit(), 100)
              && page.getOffset() == null
              && validCursor(page.getAfter(), 256);
          case TOPOLOGY -> page.getConceptId() == null
              && page.getOffset() == null
              && page.getLimit() == null
              && validCursor(page.getAfter(), MAX_CURSOR_LENGTH);
        };
    if (!valid) {
      throw invalidContext();
    }
  }

  private static boolean validLimit(Integer limit, int maximum) {
    return limit != null && limit > 0 && limit <= maximum;
  }

  private static boolean validCursor(String after, int maximum) {
    return after != null && !after.isBlank() && after.length() <= maximum;
  }

  private static BadRequestException invalidContext() {
    return new BadRequestException("Invalid native graph page context");
  }

  private static BadRequestException invalidCursor() {
    return new BadRequestException("Invalid native graph topology cursor");
  }

  private static PreconditionFailedException changedBindings() {
    return new PreconditionFailedException("Concept bindings changed. Refresh the graph.");
  }

  private static PreconditionFailedException graphChanged() {
    return new PreconditionFailedException("The loaded graph changed. Refresh the graph.");
  }

  record SemanticPage(Set<Link> links, AxiomPosition after, int targetOffset, boolean done) {}

  private record LineagePage(List<Edge> edges, LineagePosition after, boolean done) {}

  private record WireCursor(
      int version,
      String contextDigest,
      String semanticAfterId,
      int targetOffset,
      LineagePosition lineageAfter,
      boolean semanticDone,
      boolean lineageDone) {}

  record Cursor(
      int version,
      String contextDigest,
      AxiomPosition semanticAfter,
      int targetOffset,
      LineagePosition lineageAfter,
      boolean semanticDone,
      boolean lineageDone) {
    static Cursor first(String digest) {
      return new Cursor(1, digest, AxiomPosition.FIRST, 0, LineagePosition.FIRST, false, false);
    }

    String encode() {
      return RestUtil.encodeCursor(
          JsonUtils.pojoToJson(
              new WireCursor(
                  version,
                  contextDigest,
                  semanticAfter.id(),
                  targetOffset,
                  lineageAfter,
                  semanticDone,
                  lineageDone)));
    }

    static Cursor decode(String value, String digest) {
      if (!validCursor(value, MAX_CURSOR_LENGTH)) {
        throw invalidCursor();
      }
      try {
        final var cursor = JsonUtils.readValue(RestUtil.decodeCursor(value), WireCursor.class);
        if (cursor == null
            || cursor.version() != 1
            || !digest.equals(cursor.contextDigest())
            || cursor.semanticAfterId() == null
            || cursor.lineageAfter() == null
            || cursor.targetOffset() < 0
            || cursor.lineageAfter().fromId() == null
            || cursor.lineageAfter().toId() == null
            || cursor.lineageAfter().relationType() == null) {
          throw invalidCursor();
        }
        requireUuidOrEmpty(cursor.semanticAfterId());
        requireUuidOrEmpty(cursor.lineageAfter().fromId());
        requireUuidOrEmpty(cursor.lineageAfter().toId());
        return new Cursor(
            cursor.version(),
            cursor.contextDigest(),
            new AxiomPosition("", cursor.semanticAfterId()),
            cursor.targetOffset(),
            cursor.lineageAfter(),
            cursor.semanticDone(),
            cursor.lineageDone());
      } catch (IllegalArgumentException | JsonParsingException invalid) {
        throw invalidCursor();
      }
    }

    private static void requireUuidOrEmpty(String value) {
      if (!value.isEmpty()) {
        UUID.fromString(value);
      }
    }
  }
}
