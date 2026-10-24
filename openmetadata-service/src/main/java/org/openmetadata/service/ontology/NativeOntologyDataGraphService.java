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
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.ConceptAssetCount;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.LiveAsset;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.jdbi3.OntologyConceptRepository;
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

  public record Query(
      int limit, int offset, int assetsPerConcept, int edgeLimit, int lineageEdgeLimit) {}

  private final CollectionDAO dao;
  private final OntologyConceptBindingStore store;
  private final OntologyConceptRepository concepts;
  private final ViewPermissionFilter visibility;

  public NativeOntologyDataGraphService(
      final CollectionDAO dao,
      final OntologyConceptRepository concepts,
      final Authorizer authorizer) {
    this.dao = dao;
    this.store = new OntologyConceptBindingStore(dao);
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
    final var rows = store.rows(visibleConcepts.keySet());
    final var visibleAssets = visibleAssets(access, rows);
    final Map<UUID, List<BindingRow>> visibleRows =
        rows.stream()
            .filter(row -> visibleAssets.containsKey(row.assetId()))
            .collect(Collectors.groupingBy(BindingRow::conceptId));
    final List<Ranked> clusters = new ArrayList<>();
    for (final var count : ranked) {
      final var concept = visibleConcepts.get(count.conceptId());
      final var visible = visibleRows.getOrDefault(count.conceptId(), List.of());
      if (concept != null && !visible.isEmpty()) {
        clusters.add(
            new Ranked(
                concept,
                visible.subList(0, Math.min(assetsPerConcept, visible.size())),
                visible.size()));
      }
    }
    final var references = references(clusters);
    return clusters.stream().map(cluster -> cluster.resolve(references, visibleAssets)).toList();
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

  /** Admins skip the per-entity policy load; everyone else gets the batched VIEW_BASIC filter. */
  private Set<UUID> viewableIds(final Access access, final List<EntityReference> references) {
    if (references.isEmpty()) {
      return Set.of();
    }
    if (DefaultAuthorizer.getSubjectContext(access.securityContext()).isAdmin()) {
      return references.stream().map(EntityReference::getId).collect(Collectors.toSet());
    }
    return visibility.viewableIds(access.securityContext(), references);
  }

  private static Map<UUID, EntityReference> references(final List<Ranked> clusters) {
    final var pageRows = clusters.stream().flatMap(cluster -> cluster.page().stream()).toList();
    final Map<UUID, EntityReference> references = new HashMap<>();
    BindingRow.assetIdsByType(pageRows)
        .forEach(
            (type, ids) ->
                Entity.getEntityReferencesByIds(type.value(), ids, Include.NON_DELETED)
                    .forEach(reference -> references.put(reference.getId(), reference)));
    return references;
  }

  /**
   * An object property joins two returned concepts when an axiom of the first asserts the property
   * towards the second, or restricts the first over the property to a filler naming the second.
   * The query already keeps only the axiom types that can state either.
   */
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
    final var axioms =
        dao.ontologyReferenceDAO()
            .listPropertyEdgeAxioms(
                ontologyId,
                conceptsByIri.keySet().stream().map(DigestUtils::sha256Hex).toList(),
                GlossaryTermRepository.ontologyRelationCandidateLimit(edgeLimit));
    final Set<Link> links = new LinkedHashSet<>();
    for (final String json : axioms) {
      if (links.size() >= edgeLimit) {
        break;
      }
      final var axiom = JsonUtils.readValue(json, OntologyAxiom.class);
      final UUID from =
          axiom.getSubjectIri() == null
              ? null
              : conceptsByIri.get(axiom.getSubjectIri().toString());
      if (from == null) {
        continue;
      }
      for (final var target : targets(axiom)) {
        final UUID to = conceptsByIri.get(target.classIri().toString());
        if (to != null && links.size() < edgeLimit) {
          links.add(new Link(from, to, target.propertyIri()));
        }
      }
    }
    final var properties = viewableProperties(access, ontologyId, links);
    return links.stream()
        .map(link -> link.edge(properties.get(link.propertyIri().toString())))
        .toList();
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

  /**
   * The ontology's declarations of the linked property IRIs that the reader may view. A hidden
   * declaration is treated as absent, so its name reaches no one who cannot read the property.
   */
  private Map<String, OntologyProperty> viewableProperties(
      final Access access, final UUID ontologyId, final Set<Link> links) {
    final Set<String> iris = new LinkedHashSet<>();
    links.forEach(link -> iris.add(link.propertyIri().toString()));
    if (iris.isEmpty()) {
      return Map.of();
    }
    final List<OntologyProperty> declared =
        dao
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
    final var viewable =
        viewableIds(access, declared.stream().map(OntologyProperty::getEntityReference).toList());
    final Map<String, OntologyProperty> properties = new HashMap<>();
    declared.stream()
        .filter(property -> viewable.contains(property.getId()))
        .forEach(property -> properties.putIfAbsent(property.getIri().toString(), property));
    return properties;
  }

  private List<Edge> lineage(final List<Cluster> clusters, final int lineageEdgeLimit) {
    final List<String> assetIds =
        clusters.stream()
            .flatMap(cluster -> cluster.response().getAssets().stream())
            .map(asset -> asset.getAsset().getId().toString())
            .distinct()
            .toList();
    if (assetIds.isEmpty()) {
      return List.of();
    }
    return dao
        .ontologyDAO()
        .listLineageEdges(
            assetIds,
            Relationship.UPSTREAM.ordinal(),
            GlossaryTermRepository.ontologyRelationCandidateLimit(lineageEdgeLimit),
            lineageEdgeLimit)
        .stream()
        .map(
            row ->
                new Edge()
                    .withFromEntity(UUID.fromString(row.fromId()))
                    .withToEntity(UUID.fromString(row.toId())))
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

  private record Ranked(OntologyConcept concept, List<BindingRow> page, int assetCount) {
    Cluster resolve(final Map<UUID, EntityReference> references, final Map<UUID, LiveAsset> live) {
      final List<NativeOntologyClusterAsset> assets = new ArrayList<>();
      for (final var row : page) {
        final var reference = references.get(row.assetId());
        if (reference != null) {
          assets.add(
              new NativeOntologyClusterAsset()
                  .withAsset(reference)
                  .withServiceType(live.get(row.assetId()).serviceType())
                  .withColumnCount(row.columns().size()));
        }
      }
      return new Cluster(
          concept,
          new NativeOntologyAssetCluster()
              .withConcept(concept.getEntityReference())
              .withAssetCount(assetCount)
              .withAssets(assets)
              .withAfter(
                  assetCount > page.size()
                      ? RestUtil.encodeCursor(page.getLast().assetId().toString())
                      : null));
    }
  }

  private record Cluster(OntologyConcept concept, NativeOntologyAssetCluster response) {}
}
