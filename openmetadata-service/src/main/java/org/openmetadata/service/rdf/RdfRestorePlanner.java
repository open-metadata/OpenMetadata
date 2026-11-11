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
package org.openmetadata.service.rdf;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.rdf.RdfEntityLiveness.Endpoint;

/**
 * Plans the live writes that put restored entities back into the graph. A soft delete removed each
 * entity with every edge that touched it, and re-projecting the entity brings back only its own
 * triples, so a restore also needs:
 *
 * <ul>
 *   <li>every relationship row with a restored entity at either end, lineage included, whose other
 *       end is live;
 *   <li>the typed relations of restored glossary terms;
 *   <li>a re-projection of each live entity that references a restored one, since that entity's
 *       own triples (such as {@code om:hasOwner} or {@code om:hasTag}) pointed at it.
 * </ul>
 *
 * <p>A cascade is planned once, after all of it is restored, so an edge between two restored
 * entities is written once. The plan only uses existing write types, which re-check liveness when
 * they are applied.
 */
public final class RdfRestorePlanner {
  private static final String DEFAULT_TERM_RELATION = "relatedTo";
  private static final Set<String> LABEL_TYPES = Set.of(Entity.TAG, Entity.GLOSSARY_TERM);

  private final Sources sources;
  private final RdfEntityLiveness liveness;

  /** The metadata a restore plan is built from. */
  public interface Sources {
    /** Every relationship row that has one of {@code entityIds} at either end. */
    List<EntityRelationshipObject> relationshipsOf(String entityType, List<UUID> entityIds);

    /** The entities whose labels, or whose columns' labels, use one of these tags or terms. */
    Set<Endpoint> labelledEntities(String labelType, List<UUID> labelIds);

    /** The typed relations each of these glossary terms states in its related terms. */
    List<GlossaryRelation> glossaryRelations(Collection<UUID> termIds);
  }

  /** A typed relation from one glossary term to another. */
  public record GlossaryRelation(UUID fromTermId, UUID toTermId, String relationType) {}

  public RdfRestorePlanner(final Sources sources, final RdfEntityLiveness liveness) {
    this.sources = sources;
    this.liveness = liveness;
  }

  public List<RdfLiveWrite> plan(final Collection<Endpoint> restoredEntities) {
    final Set<Endpoint> restored = new LinkedHashSet<>(restoredEntities);
    final List<EntityRelationshipObject> rows = relationshipRows(restored);
    final Set<Endpoint> live = liveness.liveEndpoints(endpointsOf(rows, restored));
    final List<RdfLiveWrite> writes = new ArrayList<>(edges(rows, live));
    writes.addAll(termRelations(restored, rows, live));
    writes.addAll(referrerUpdates(restored, rows, live));
    return List.copyOf(writes);
  }

  private List<EntityRelationshipObject> relationshipRows(final Set<Endpoint> restored) {
    final List<EntityRelationshipObject> rows = new ArrayList<>();
    idsByType(restored).forEach((type, ids) -> rows.addAll(sources.relationshipsOf(type, ids)));
    return rows;
  }

  private static Set<Endpoint> endpointsOf(
      final List<EntityRelationshipObject> rows, final Set<Endpoint> restored) {
    final Set<Endpoint> endpoints = new LinkedHashSet<>(restored);
    for (final EntityRelationshipObject row : rows) {
      endpoints.add(from(row));
      endpoints.add(to(row));
    }
    return endpoints;
  }

  private static List<RdfLiveWrite> edges(
      final List<EntityRelationshipObject> rows, final Set<Endpoint> live) {
    final Map<EdgeKey, RdfLiveWrite> edges = new LinkedHashMap<>();
    for (final EntityRelationshipObject row : rows) {
      if (isRestorableEdge(row, live)) {
        edges.putIfAbsent(
            new EdgeKey(from(row), to(row), row.getRelation()),
            RdfLiveWrite.RelationshipChange.capture(
                RdfRelationshipScope.toEntityRelationship(row), false));
      }
    }
    return List.copyOf(edges.values());
  }

  private static boolean isRestorableEdge(
      final EntityRelationshipObject row, final Set<Endpoint> live) {
    return RdfRelationshipScope.isProjectedEdge(row)
        && !RdfRelationshipScope.isTypedGlossaryRelation(row)
        && live.contains(from(row))
        && live.contains(to(row));
  }

  /**
   * Both terms of a typed relation state it in their related terms, each from its own side, and the
   * reindex writes both; so does a restore, for every relation that touches a restored term.
   */
  private List<RdfLiveWrite> termRelations(
      final Set<Endpoint> restored,
      final List<EntityRelationshipObject> rows,
      final Set<Endpoint> live) {
    final Set<UUID> restoredTerms = idsOfType(restored, Entity.GLOSSARY_TERM);
    final Set<UUID> terms = new LinkedHashSet<>(restoredTerms);
    rows.stream()
        .filter(RdfRelationshipScope::isTypedGlossaryRelation)
        .flatMap(row -> List.of(from(row), to(row)).stream())
        .filter(live::contains)
        .forEach(term -> terms.add(term.entityId()));
    final List<RdfLiveWrite> writes = new ArrayList<>();
    if (!restoredTerms.isEmpty()) {
      for (final GlossaryRelation relation :
          new LinkedHashSet<>(sources.glossaryRelations(terms))) {
        if (touchesRestoredLiveTerms(relation, restoredTerms, live)) {
          writes.add(
              new RdfLiveWrite.GlossaryRelationChange(
                  relation.fromTermId(),
                  relation.toTermId(),
                  relationTypeOrDefault(relation),
                  false));
        }
      }
    }
    return writes;
  }

  private static boolean touchesRestoredLiveTerms(
      final GlossaryRelation relation, final Set<UUID> restoredTerms, final Set<Endpoint> live) {
    return (restoredTerms.contains(relation.fromTermId())
            || restoredTerms.contains(relation.toTermId()))
        && live.contains(new Endpoint(Entity.GLOSSARY_TERM, relation.fromTermId()))
        && live.contains(new Endpoint(Entity.GLOSSARY_TERM, relation.toTermId()));
  }

  private static String relationTypeOrDefault(final GlossaryRelation relation) {
    return relation.relationType() == null ? DEFAULT_TERM_RELATION : relation.relationType();
  }

  private List<RdfLiveWrite> referrerUpdates(
      final Set<Endpoint> restored,
      final List<EntityRelationshipObject> rows,
      final Set<Endpoint> live) {
    final Set<Endpoint> referrers = new LinkedHashSet<>();
    for (final EntityRelationshipObject row : rows) {
      referrers.add(restored.contains(from(row)) ? to(row) : from(row));
    }
    referrers.retainAll(live);
    referrers.addAll(labelledEntities(restored));
    return referrers.stream()
        .filter(referrer -> !restored.contains(referrer))
        .filter(referrer -> RdfRelationshipScope.isProjectedEndpoint(referrer.entityType()))
        .<RdfLiveWrite>map(
            referrer -> new RdfLiveWrite.EntityUpdate(referrer.entityType(), referrer.entityId()))
        .toList();
  }

  /** Tag and glossary-term labels live in {@code tag_usage}, not in relationship rows. */
  private Set<Endpoint> labelledEntities(final Set<Endpoint> restored) {
    final Set<Endpoint> labelled = new LinkedHashSet<>();
    idsByType(restored)
        .forEach(
            (type, ids) -> {
              if (LABEL_TYPES.contains(type)) {
                labelled.addAll(sources.labelledEntities(type, ids));
              }
            });
    return labelled;
  }

  private static Map<String, List<UUID>> idsByType(final Set<Endpoint> endpoints) {
    return endpoints.stream()
        .collect(
            Collectors.groupingBy(
                Endpoint::entityType,
                LinkedHashMap::new,
                Collectors.mapping(Endpoint::entityId, Collectors.toList())));
  }

  private static Set<UUID> idsOfType(final Set<Endpoint> endpoints, final String entityType) {
    return endpoints.stream()
        .filter(endpoint -> entityType.equals(endpoint.entityType()))
        .map(Endpoint::entityId)
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private static Endpoint from(final EntityRelationshipObject row) {
    return new Endpoint(row.getFromEntity(), UUID.fromString(row.getFromId()));
  }

  private static Endpoint to(final EntityRelationshipObject row) {
    return new Endpoint(row.getToEntity(), UUID.fromString(row.getToId()));
  }

  private record EdgeKey(Endpoint from, Endpoint to, int relation) {}
}
