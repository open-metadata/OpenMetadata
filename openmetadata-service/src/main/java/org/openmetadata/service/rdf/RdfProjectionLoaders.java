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

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
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

  private static StoredLineageEdge storedLineageEdge(final EntityRelationshipObject edge) {
    final String json = edge.getJson();
    return new StoredLineageEdge(
        json == null ? null : JsonUtils.readValue(json, LineageDetails.class));
  }
}
