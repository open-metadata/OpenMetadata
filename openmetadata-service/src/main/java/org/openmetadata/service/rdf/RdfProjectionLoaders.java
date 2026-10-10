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
    LineageDetailsLoader lineageDetailsLoader) {

  @FunctionalInterface
  interface LineageDetailsLoader {
    /** Returns the stored details of the lineage edge, or empty when the edge no longer exists. */
    Optional<LineageDetails> load(UUID fromId, UUID toId);
  }

  static RdfProjectionLoaders defaults() {
    return new RdfProjectionLoaders(
        RdfProjectionLoaders::loadEntity, RdfProjectionLoaders::loadLineageDetails);
  }

  private static EntityInterface<?> loadEntity(final String entityType, final UUID entityId) {
    return Entity.getEntity(
        entityType,
        entityId,
        String.join(",", RdfIndexingFields.forEntityType(entityType)),
        Include.ALL,
        false);
  }

  private static Optional<LineageDetails> loadLineageDetails(final UUID fromId, final UUID toId) {
    final EntityRelationshipObject edge =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .getRecord(fromId, toId, Relationship.UPSTREAM.ordinal());
    return Optional.ofNullable(edge)
        .map(EntityRelationshipObject::getJson)
        .map(json -> JsonUtils.readValue(json, LineageDetails.class));
  }
}
