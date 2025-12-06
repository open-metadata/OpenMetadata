/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.notifications.recipients.downstream;

import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.type.EntityReference;

/**
 * Strategy for resolving entities to their lineage-capable parent entities.
 *
 * Some entities (e.g., TestCase) don't participate directly in lineage but represent
 * metadata about other entities. This interface allows entity-specific transformations
 * to extract parent entities before lineage traversal.
 *
 * Most entities have 1:1 parent relationships (TestCase → Table).
 * Some entities have 1:N relationships (TestSuite → multiple parent entities).
 *
 * Implementations are stateless and thread-safe.
 */
public interface EntityLineageResolver {
  /**
   * Resolves an entity to its lineage-capable parent entities.
   *
   * Returns a set of parent entity references. Empty set means the entity itself
   * is lineage-capable and should be used for traversal.
   *
   * Examples:
   * - TestCase → {Table} (1:1 relationship)
   * - Thread → {TestCase} (1:1 relationship)
   * - TestSuite → {Table1, Table2, ...} (1:N from failed tests)
   * - Table → {} (empty set, is lineage entity)
   *
   * @param entityId the ID of the entity to resolve
   * @param entityType the type of the entity
   * @return Set of parent EntityReferences, or empty set if entity is lineage-capable
   */
  Set<EntityReference> resolveTraversalEntities(UUID entityId, String entityType);

  /**
   * Returns the entity type this resolver handles.
   *
   * @return entity type constant (e.g., Entity.TEST_CASE, Entity.THREAD, Entity.TEST_SUITE, "*" for default)
   */
  String getEntityType();
}
