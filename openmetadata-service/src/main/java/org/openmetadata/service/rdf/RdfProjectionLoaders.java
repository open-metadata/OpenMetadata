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

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.util.LikeEscape;

/**
 * Reads the current metadata a live-write replay projects. Replays load state when they run rather
 * than carrying payloads, so a delayed replay never restores an obsolete snapshot. The entity
 * loader reads live entities only, with their latest profiles and test results, and fails as not
 * found for a soft-deleted one, which the replay turns into a delete: the graph projects the live
 * catalog.
 */
record RdfProjectionLoaders(
    BiFunction<String, UUID, EntityInterface<?>> entityLoader,
    LineageDetailsLoader lineageDetailsLoader,
    RelationshipExists relationshipExists,
    GlossaryTermRelationRows glossaryTermRelationRows,
    Supplier<OntologyActiveGraph> ontologyGraphs,
    RdfEntityLiveness liveness,
    BoundAssets boundAssets,
    TestCaseRequeue testCaseRequeue) {

  /** Queues a fresh projection of every test case on a table whose columns or tags changed. */
  @FunctionalInterface
  interface TestCaseRequeue {
    void requeueTestCasesOf(String tableFqn);
  }

  @FunctionalInterface
  interface LineageDetailsLoader {
    /** Returns the stored lineage edge, or empty when the edge no longer exists. */
    Optional<StoredLineageEdge> load(UUID fromId, UUID toId);
  }

  /** Whether a directed non-lineage relationship row still exists in SQL. */
  @FunctionalInterface
  interface RelationshipExists {
    boolean exists(
        UUID fromId, String fromEntity, UUID toId, String toEntity, Relationship relationship);
  }

  /** Current glossary-term {@code RELATED_TO} rows between two terms in either direction. */
  @FunctionalInterface
  interface GlossaryTermRelationRows {
    List<EntityRelationshipObject> load(UUID fromTermId, UUID toTermId);
  }

  /** The assets bound to the concepts of one ontology, in asset id order. */
  @FunctionalInterface
  interface BoundAssets {
    int PAGE_SIZE = 500;

    /** At most {@code limit} assets whose id sorts after {@code after}; "" starts the walk. */
    List<EntityReference> page(UUID ontologyId, String after, int limit);
  }

  /** A lineage edge that still exists; {@code details} is null when none were stored for it. */
  record StoredLineageEdge(LineageDetails details) {}

  static RdfProjectionLoaders defaults() {
    return new RdfProjectionLoaders(
        withQualityEvidence(RdfProjectionLoaders::loadEntity, RdfQualityEvidence.database()),
        RdfProjectionLoaders::loadLineageDetails,
        RdfProjectionLoaders::relationshipRowExists,
        RdfProjectionLoaders::loadGlossaryTermRelationRows,
        () -> new OntologyActiveGraph(Entity.getCollectionDAO()),
        RdfEntityLiveness.database(),
        RdfProjectionLoaders::loadBoundAssets,
        RdfProjectionLoaders::requeueTestCases);
  }

  private static List<EntityReference> loadBoundAssets(
      final UUID ontologyId, final String after, final int limit) {
    return Entity.getCollectionDAO()
        .ontologyConceptBindingDAO()
        .listBoundAssets(ontologyId.toString(), after, limit)
        .stream()
        .map(
            asset ->
                new EntityReference()
                    .withType(asset.assetType())
                    .withId(UUID.fromString(asset.assetId())))
        .toList();
  }

  /** Queues the test cases whose entity link names {@code tableFqn} or one of its columns. */
  private static void requeueTestCases(final String tableFqn) {
    final List<EntityReference> testCases =
        Entity.getCollectionDAO()
            .testCaseDAO()
            .findIdsByEntityFQN(tableFqn, LikeEscape.escape(tableFqn) + Entity.SEPARATOR + "%")
            .stream()
            .map(id -> new EntityReference().withType(Entity.TEST_CASE).withId(UUID.fromString(id)))
            .toList();
    RdfUpdater.refreshEntities(testCases);
  }

  /** Reads entities with {@code loader} and loads their latest quality evidence onto them. */
  static BiFunction<String, UUID, EntityInterface<?>> withQualityEvidence(
      final BiFunction<String, UUID, EntityInterface<?>> loader,
      final RdfQualityEvidence evidence) {
    return (entityType, entityId) -> {
      final EntityInterface<?> entity = loader.apply(entityType, entityId);
      evidence.attach(entityType, List.of(entity));
      return entity;
    };
  }

  private static EntityInterface<?> loadEntity(final String entityType, final UUID entityId) {
    return Entity.getEntity(
        entityType,
        entityId,
        String.join(",", RdfIndexingFields.forEntityType(entityType)),
        Include.NON_DELETED,
        false);
  }

  private static Optional<StoredLineageEdge> loadLineageDetails(
      final UUID fromId, final UUID toId) {
    final EntityRelationshipObject edge =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .getRecord(fromId, toId, Relationship.UPSTREAM.ordinal());
    return Optional.ofNullable(edge).map(RdfProjectionLoaders::storedLineageEdge);
  }

  /**
   * Matches a non-lineage relationship against SQL. Metric.relatedMetrics stores one canonical
   * {@link Relationship#RELATED_TO} row while queuing RDF adds in both directions. Table foreign
   * keys and related knowledge pages also use RELATED_TO, but store directed rows.
   */
  boolean relationshipExists(final EntityRelationship relationship) {
    if (relationship == null
        || relationship.getFromId() == null
        || relationship.getToId() == null
        || relationship.getFromEntity() == null
        || relationship.getToEntity() == null
        || relationship.getRelationshipType() == null) {
      return false;
    }
    if (relationshipExists.exists(
        relationship.getFromId(),
        relationship.getFromEntity(),
        relationship.getToId(),
        relationship.getToEntity(),
        relationship.getRelationshipType())) {
      return true;
    }
    return isBidirectionalMetricRelationship(relationship)
        && !relationship.getFromId().equals(relationship.getToId())
        && relationshipExists.exists(
            relationship.getToId(),
            relationship.getToEntity(),
            relationship.getFromId(),
            relationship.getFromEntity(),
            relationship.getRelationshipType());
  }

  private static boolean isBidirectionalMetricRelationship(final EntityRelationship relationship) {
    return relationship.getRelationshipType() == Relationship.RELATED_TO
        && Entity.METRIC.equals(relationship.getFromEntity())
        && Entity.METRIC.equals(relationship.getToEntity());
  }

  private static boolean relationshipRowExists(
      final UUID fromId,
      final String fromEntity,
      final UUID toId,
      final String toEntity,
      final Relationship relationship) {
    return Entity.getCollectionDAO()
        .relationshipDAO()
        .exists(fromId, fromEntity, toId, toEntity, relationship.ordinal());
  }

  private static List<EntityRelationshipObject> loadGlossaryTermRelationRows(
      final UUID fromTermId, final UUID toTermId) {
    if (fromTermId == null || toTermId == null) {
      return List.of();
    }
    return Entity.getCollectionDAO()
        .relationshipDAO()
        .findBetween(fromTermId, toTermId, Entity.GLOSSARY_TERM, Relationship.RELATED_TO.ordinal());
  }

  /**
   * Matches a directed glossary term relation against current SQL rows in either storage direction.
   * {@code GlossaryTermRepository} stores each pair canonically with {@code fromId < toId} (using
   * the inverse type when authored from the larger UUID); checking both directions also matches
   * legacy non-canonical rows.
   */
  static boolean hasGlossaryTermRelation(
      final List<EntityRelationshipObject> rows,
      final UUID fromTermId,
      final UUID toTermId,
      final String relationTypeName,
      final String inverseRelationTypeName) {
    if (rows == null
        || rows.isEmpty()
        || fromTermId == null
        || toTermId == null
        || relationTypeName == null) {
      return false;
    }
    final String from = fromTermId.toString();
    final String to = toTermId.toString();
    final String reverseMatch =
        inverseRelationTypeName != null ? inverseRelationTypeName : relationTypeName;
    for (final EntityRelationshipObject row : rows) {
      final String storedType = storedRelationType(row);
      if (from.equalsIgnoreCase(row.getFromId())
          && to.equalsIgnoreCase(row.getToId())
          && relationTypeName.equalsIgnoreCase(storedType)) {
        return true;
      }
      if (!from.equalsIgnoreCase(to)
          && to.equalsIgnoreCase(row.getFromId())
          && from.equalsIgnoreCase(row.getToId())
          && reverseMatch.equalsIgnoreCase(storedType)) {
        return true;
      }
    }
    return false;
  }

  static String storedRelationType(final EntityRelationshipObject row) {
    if (row.getRelationType() != null && !row.getRelationType().isBlank()) {
      return row.getRelationType();
    }
    if (row.getJson() != null && !row.getJson().isBlank()) {
      try {
        final JsonNode node = JsonUtils.readTree(row.getJson());
        final String fromJson = node.path("relationType").asText(null);
        if (fromJson != null && !fromJson.isBlank()) {
          return fromJson;
        }
      } catch (RuntimeException ignored) {
        // Legacy or malformed JSON falls back to the default glossary relation type.
      }
    }
    return "relatedTo";
  }

  private static StoredLineageEdge storedLineageEdge(final EntityRelationshipObject edge) {
    final String json = edge.getJson();
    return new StoredLineageEdge(
        json == null ? null : JsonUtils.readValue(json, LineageDetails.class));
  }
}
