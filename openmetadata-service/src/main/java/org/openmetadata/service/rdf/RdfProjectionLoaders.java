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

import java.util.Optional;
import java.util.UUID;
import java.util.function.BiFunction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

/**
 * Reads the current metadata a live-write replay projects. Replays load state when they run rather
 * than carrying payloads, so a delayed replay never restores an obsolete snapshot.
 */
record RdfProjectionLoaders(
    BiFunction<String, UUID, EntityInterface<?>> entityLoader,
    LineageDetailsLoader lineageDetailsLoader,
    OntologyGraphProjection.Sources ontologySources) {

  RdfProjectionLoaders(
      final BiFunction<String, UUID, EntityInterface<?>> entityLoader,
      final LineageDetailsLoader lineageDetailsLoader) {
    this(entityLoader, lineageDetailsLoader, OntologyGraphProjection.databaseSources());
  }

  @FunctionalInterface
  interface LineageDetailsLoader {
    /** Returns the stored lineage edge, or empty when the edge no longer exists. */
    Optional<StoredLineageEdge> load(UUID fromId, UUID toId);
  }

  /** A lineage edge that still exists; {@code details} is null when none were stored for it. */
  record StoredLineageEdge(LineageDetails details) {}

  static RdfProjectionLoaders defaults() {
    return new RdfProjectionLoaders(
        RdfProjectionLoaders::loadEntity,
        RdfProjectionLoaders::loadLineageDetails,
        OntologyGraphProjection.databaseSources());
  }

  private static EntityInterface<?> loadEntity(final String entityType, final UUID entityId) {
    return Entity.getEntity(
        entityType,
        entityId,
        String.join(",", RdfIndexingFields.forEntityType(entityType)),
        Include.ALL,
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
