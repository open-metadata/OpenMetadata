/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.jdbi3.OntologyConceptBindingStore.SCAN_PAGE_SIZE;

import jakarta.ws.rs.ServiceUnavailableException;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.api.data.NativeOntologyAssetCluster;
import org.openmetadata.schema.api.data.NativeOntologyClusterAsset;
import org.openmetadata.schema.api.data.NativeOntologyConceptEdge;
import org.openmetadata.schema.api.data.NativeOntologyDataGraph;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingPosition;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.ConceptAssetCount;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.LiveAsset;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.jdbi3.OntologyConceptRepository;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO.AxiomPosition;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO.EdgeAxiomRow;
import org.openmetadata.service.ontology.OntologyConceptBindingService.Access;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.util.RestUtil;

/**
 * One page of a native ontology's bound concepts, ranked by stored binding count, each with the
 * assets the caller may view. Concepts are joined by the object properties their axioms state and
 * returned assets by observed lineage. Lookups batch by entity type to avoid one read per binding.
 * Reads take no ontology lock.
 */
public final class NativeOntologyDataGraphService {
  private static final String PROPERTY_TABLE = "ontology_property_entity";
  private static final int AXIOM_SCAN_PAGE_SIZE = 500;

  public record Query(
      int limit, int offset, int assetsPerConcept, int edgeLimit, int lineageEdgeLimit) {}

  private final CollectionDAO dao;
  private final OntologyConceptBindingStore store;
  private final OntologyConceptRepository concepts;
  private final ViewPermissionFilter visibility;

  public NativeOntologyDataGraphService(
      final CollectionDAO dao,
      final OntologyConceptBindingStore store,
      final OntologyConceptRepository concepts,
      final Authorizer authorizer) {
    this.dao = dao;
    this.store = store;
    this.concepts = concepts;
    this.visibility = new ViewPermissionFilter(authorizer);
  }

  /** The caller's right to view the ontology itself is checked by the resource. */
  public NativeOntologyDataGraph graph(
      final Access access, final UUID ontologyId, final Query query) {
    final var clusters =
        clusters(
            access,
            store.boundConcepts(ontologyId, query.limit(), query.offset()),
            query.assetsPerConcept());
    return new NativeOntologyDataGraph()
        .withClusters(clusters.stream().map(Cluster::response).toList())
        .withEdges(edges(access, ontologyId, clusters, query.edgeLimit()))
        .withLineageEdges(lineage(clusters, query.lineageEdgeLimit()))
        .withPaging(
            new Paging()
                .withOffset(query.offset())
                .withLimit(query.limit())
                .withTotal(store.countBoundConcepts(ontologyId)));
  }

  /**
   * Ranking uses the stored row count so a page is stable for every reader; {@code assetCount} and
   * the assets are what this reader may view, and a concept with nothing viewable is left out.
   */
  private List<Cluster> clusters(
      final Access access, final List<ConceptAssetCount> ranked, final int assetsPerConcept) {
    if (ranked.isEmpty()) {
      return List.of();
    }
    final var visibleConcepts =
        visibleConcepts(access, ranked.stream().map(ConceptAssetCount::conceptId).toList());
    final var summaries = visibleBindings(access, visibleConcepts.keySet(), assetsPerConcept);
    final var references = references(summaries);
    final List<Cluster> clusters = new ArrayList<>();
    for (final var count : ranked) {
      final var concept = visibleConcepts.get(count.conceptId());
      final var summary = summaries.get(count.conceptId());
      if (concept != null && summary.assetCount() > 0) {
        clusters.add(new Cluster(concept, summary.resolve(concept, references)));
      }
    }
    return List.copyOf(clusters);
  }

  private Map<UUID, VisibleSummary> visibleBindings(
      final Access access, final Set<UUID> conceptIds, final int previewSize) {
    final Map<UUID, VisibleSummary> summaries = new LinkedHashMap<>();
    conceptIds.forEach(id -> summaries.put(id, new VisibleSummary(previewSize)));
    BindingPosition after = null;
    do {
      after = scanBindingPage(access, summaries, after);
    } while (after != null);
    return summaries;
  }

  private BindingPosition scanBindingPage(
      final Access access, final Map<UUID, VisibleSummary> summaries, final BindingPosition after) {
    final var rows = store.page(summaries.keySet(), after, SCAN_PAGE_SIZE);
    final var visible = visibleAssets(access, rows);
    rows.forEach(row -> summaries.get(row.conceptId()).add(row, visible.get(row.assetId())));
    return rows.size() == SCAN_PAGE_SIZE
        ? new BindingPosition(rows.getLast().conceptId(), rows.getLast().assetId())
        : null;
  }

  private Map<UUID, OntologyConcept> visibleConcepts(final Access access, final List<UUID> ids) {
    final var loaded = concepts.find(ids, Include.NON_DELETED);
    final var viewable =
        viewableIds(access, loaded.stream().map(OntologyConcept::getEntityReference).toList());
    final Map<UUID, OntologyConcept> visible = new LinkedHashMap<>();
    loaded.stream()
        .filter(concept -> viewable.contains(concept.getId()))
        .forEach(concept -> visible.put(concept.getId(), concept));
    return visible;
  }

  private Map<UUID, LiveAsset> visibleAssets(final Access access, final List<BindingRow> rows) {
    final var live = store.liveAssets(rows);
    final Map<UUID, EntityReference> references = new HashMap<>();
    for (final var row : rows) {
      if (live.containsKey(row.assetId())) {
        references.putIfAbsent(
            row.assetId(),
            new EntityReference().withType(row.assetType().value()).withId(row.assetId()));
      }
    }
    live.keySet().retainAll(viewableIds(access, new ArrayList<>(references.values())));
    return live;
  }

  private Set<UUID> viewableIds(final Access access, final List<EntityReference> references) {
    if (references.isEmpty()) {
      return Set.of();
    }
    if (DefaultAuthorizer.getSubjectContext(access.securityContext()).isAdmin()) {
      return references.stream().map(EntityReference::getId).collect(Collectors.toSet());
    }
    return visibility.viewableIds(access.securityContext(), references);
  }

  private static Map<UUID, EntityReference> references(final Map<UUID, VisibleSummary> summaries) {
    final var pageRows =
        summaries.values().stream()
            .flatMap(summary -> summary.preview().stream())
            .map(Preview::row)
            .toList();
    final Map<UUID, EntityReference> references = new HashMap<>();
    BindingRow.assetIdsByType(pageRows)
        .forEach(
            (type, ids) ->
                Entity.getEntityReferencesByIds(type.value(), ids, Include.NON_DELETED)
                    .forEach(reference -> references.put(reference.getId(), reference)));
    return references;
  }

  private List<NativeOntologyConceptEdge> edges(
      final Access access,
      final UUID ontologyId,
      final List<Cluster> clusters,
      final int edgeLimit) {
    final Map<String, UUID> conceptsByIri = new HashMap<>();
    for (final var cluster : clusters) {
      conceptsByIri.putIfAbsent(cluster.concept().getIri().toString(), cluster.concept().getId());
    }
    if (conceptsByIri.isEmpty()) {
      return List.of();
    }
    final var links = links(access, ontologyId, conceptsByIri, edgeLimit);
    final var properties = viewableProperties(access, ontologyId, links);
    return links.stream()
        .map(link -> link.edge(properties.get(link.propertyIri().toString())))
        .toList();
  }

  private Set<Link> links(
      final Access access,
      final UUID ontologyId,
      final Map<String, UUID> conceptsByIri,
      final int edgeLimit) {
    final var hashes = conceptsByIri.keySet().stream().map(DigestUtils::sha256Hex).toList();
    final Set<Link> links = new LinkedHashSet<>();
    AxiomPosition after = AxiomPosition.FIRST;
    do {
      final var candidates =
          dao.ontologyReferenceDAO()
              .listPropertyEdgeAxioms(ontologyId, hashes, after, AXIOM_SCAN_PAGE_SIZE);
      addViewableLinks(access, candidates, conceptsByIri, links, edgeLimit);
      after = candidates.size() == AXIOM_SCAN_PAGE_SIZE ? candidates.getLast().position() : null;
    } while (after != null && links.size() < edgeLimit);
    return links;
  }

  private void addViewableLinks(
      final Access access,
      final List<EdgeAxiomRow> candidates,
      final Map<String, UUID> conceptsByIri,
      final Set<Link> links,
      final int edgeLimit) {
    final var viewable =
        viewableIds(
            access,
            candidates.stream()
                .map(row -> new EntityReference().withId(row.id()).withType(Entity.ONTOLOGY_AXIOM))
                .toList());
    for (final var candidate : candidates) {
      if (links.size() >= edgeLimit) {
        break;
      }
      if (viewable.contains(candidate.id())) {
        addLinks(
            JsonUtils.readValue(candidate.json(), OntologyAxiom.class),
            conceptsByIri,
            links,
            edgeLimit);
      }
    }
  }

  private static void addLinks(
      final OntologyAxiom axiom,
      final Map<String, UUID> conceptsByIri,
      final Set<Link> links,
      final int edgeLimit) {
    final UUID from =
        axiom.getSubjectIri() == null ? null : conceptsByIri.get(axiom.getSubjectIri().toString());
    if (from != null) {
      for (final var target : targets(axiom)) {
        final UUID to = conceptsByIri.get(target.classIri().toString());
        if (to != null && links.size() < edgeLimit) {
          links.add(new Link(from, to, target.propertyIri()));
        }
      }
    }
  }

  static List<Target> targets(final OntologyAxiom axiom) {
    if (axiom.getAxiomType() == OntologyAxiomType.OBJECT_PROPERTY_ASSERTION) {
      return axiom.getPropertyIri() == null || axiom.getTargetIri() == null
          ? List.of()
          : List.of(new Target(axiom.getPropertyIri(), axiom.getTargetIri()));
    }
    final List<Target> targets = new ArrayList<>();
    for (final var expression : listOrEmpty(axiom.getExpressions())) {
      restrictions(expression, targets);
    }
    return targets;
  }

  private static void restrictions(
      final OntologyExpression expression, final List<Target> targets) {
    if (expression == null || expression.getKind() == null) {
      return;
    }
    switch (expression.getKind()) {
      case RESTRICTION -> {
        if (expression.getPropertyIri() != null) {
          namedClasses(expression.getFiller()).stream()
              .map(classIri -> new Target(expression.getPropertyIri(), classIri))
              .forEach(targets::add);
        }
      }
      case INTERSECTION, UNION -> listOrEmpty(expression.getOperands())
          .forEach(operand -> restrictions(operand, targets));
      default -> {}
    }
  }

  private static List<URI> namedClasses(final OntologyExpression filler) {
    if (filler == null || filler.getKind() == null) {
      return List.of();
    }
    return switch (filler.getKind()) {
      case NAMED_CLASS -> filler.getClassIri() == null ? List.of() : List.of(filler.getClassIri());
      case INTERSECTION, UNION -> listOrEmpty(filler.getOperands()).stream()
          .flatMap(operand -> namedClasses(operand).stream())
          .toList();
      default -> List.of();
    };
  }

  private Map<String, OntologyProperty> viewableProperties(
      final Access access, final UUID ontologyId, final Set<Link> links) {
    final Set<String> iris = new LinkedHashSet<>();
    links.forEach(link -> iris.add(link.propertyIri().toString()));
    if (iris.isEmpty()) {
      return Map.of();
    }
    final var declared = declaredProperties(ontologyId, iris);
    final var viewable =
        viewableIds(access, declared.stream().map(OntologyProperty::getEntityReference).toList());
    final Map<String, OntologyProperty> properties = new HashMap<>();
    declared.stream()
        .filter(property -> viewable.contains(property.getId()))
        .forEach(property -> properties.putIfAbsent(property.getIri().toString(), property));
    return properties;
  }

  private List<OntologyProperty> declaredProperties(final UUID ontologyId, final Set<String> iris) {
    return dao
        .ontologyPropertyDAO()
        .findDeclarations(
            PROPERTY_TABLE,
            ontologyId,
            iris.stream().map(DigestUtils::md5Hex).toList(),
            iris.size(),
            "")
        .stream()
        .map(json -> JsonUtils.readValue(json, OntologyProperty.class))
        .toList();
  }

  private List<Edge> lineage(final List<Cluster> clusters, final int lineageEdgeLimit) {
    final var assetIds = previewAssetIds(clusters);
    if (assetIds.isEmpty()) {
      return List.of();
    }
    return dao
        .ontologyDAO()
        .listLineageEdgesBetween(assetIds, Relationship.UPSTREAM.ordinal(), lineageEdgeLimit)
        .stream()
        .map(
            row ->
                new Edge()
                    .withFromEntity(UUID.fromString(row.fromId()))
                    .withToEntity(UUID.fromString(row.toId())))
        .toList();
  }

  private static List<String> previewAssetIds(final List<Cluster> clusters) {
    return clusters.stream()
        .flatMap(cluster -> cluster.response().getAssets().stream())
        .map(asset -> asset.getAsset().getId().toString())
        .distinct()
        .toList();
  }

  static String localName(final URI iri) {
    final String value = iri.toString();
    final int cut =
        Math.max(value.lastIndexOf('#'), Math.max(value.lastIndexOf('/'), value.lastIndexOf(':')));
    final String local = cut < 0 ? value : value.substring(cut + 1);
    return local.isEmpty() ? value : local;
  }

  record Target(URI propertyIri, URI classIri) {}

  record Link(UUID from, UUID to, URI propertyIri) {
    NativeOntologyConceptEdge edge(final OntologyProperty property) {
      final String label =
          property == null
              ? localName(propertyIri)
              : nullOrEmpty(property.getDisplayName())
                  ? property.getName()
                  : property.getDisplayName();
      return new NativeOntologyConceptEdge()
          .withFromConceptId(from)
          .withToConceptId(to)
          .withPropertyIri(propertyIri)
          .withLabel(label)
          .withProperty(property == null ? null : property.getEntityReference());
    }
  }

  record Preview(BindingRow row, LiveAsset live) {
    NativeOntologyClusterAsset resolve(final Map<UUID, EntityReference> references) {
      final var reference = references.get(row.assetId());
      if (reference == null || Boolean.TRUE.equals(reference.getDeleted())) {
        throw new ServiceUnavailableException(
            "Bound assets changed while reading the graph. Retry the read.");
      }
      return new NativeOntologyClusterAsset()
          .withAsset(reference)
          .withServiceType(live.serviceType())
          .withColumnCount(row.columns().size());
    }
  }

  static final class VisibleSummary {
    private final int previewSize;
    private final List<Preview> preview = new ArrayList<>();
    private int assetCount;

    VisibleSummary(final int previewSize) {
      this.previewSize = previewSize;
    }

    void add(final BindingRow row, final LiveAsset live) {
      if (live != null) {
        assetCount++;
        if (preview.size() < previewSize) {
          preview.add(new Preview(row, live));
        }
      }
    }

    int assetCount() {
      return assetCount;
    }

    List<Preview> preview() {
      return List.copyOf(preview);
    }

    NativeOntologyAssetCluster resolve(
        final OntologyConcept concept, final Map<UUID, EntityReference> references) {
      final var assets = preview.stream().map(item -> item.resolve(references)).toList();
      return new NativeOntologyAssetCluster()
          .withConcept(concept.getEntityReference())
          .withAssetCount(assetCount)
          .withAssets(assets)
          .withAfter(
              assetCount > assets.size()
                  ? RestUtil.encodeCursor(assets.getLast().getAsset().getId().toString())
                  : null);
    }
  }

  private record Cluster(OntologyConcept concept, NativeOntologyAssetCluster response) {}
}
