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

package org.openmetadata.service.migration.utils.v210;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import java.util.function.UnaryOperator;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;

/**
 * Data contracts used to store their entity reference exactly as the request sent it, usually just
 * id and type, so change events carried no FQN for alert filters to match. Rebuilds every stored
 * reference from the entity it points to, which also corrects a name or FQN that did not match the
 * id. Idempotent.
 */
@Slf4j
public final class DataContractEntityReferenceMigration {
  private static final int BATCH_SIZE = 1_000;
  private static final String ENTITY = "entity";

  private DataContractEntityReferenceMigration() {}

  public static void rebuildDataContractEntityReferences(CollectionDAO collectionDAO) {
    rebuildDataContractEntityReferences(
        collectionDAO.dataContractDAO(),
        ref -> Entity.getEntityReferenceById(ref.getType(), ref.getId(), Include.ALL));
  }

  static int rebuildDataContractEntityReferences(
      EntityDAO<?> contractDAO, UnaryOperator<EntityReference> lookup) {
    int rebuilt = 0;
    List<String> batch = nextBatch(contractDAO, "", "");
    while (!batch.isEmpty()) {
      ObjectNode last = null;
      for (String json : batch) {
        last = (ObjectNode) JsonUtils.readTree(json);
        rebuilt += rebuildAndStore(contractDAO, last, lookup);
      }
      batch = nextBatch(contractDAO, last.path("name").asText(), last.path("id").asText());
    }
    LOG.info("Rebuilt the entity reference of {} data contract(s)", rebuilt);
    return rebuilt;
  }

  private static List<String> nextBatch(
      EntityDAO<?> contractDAO, String afterName, String afterId) {
    return contractDAO.listAfter(new ListFilter(Include.ALL), BATCH_SIZE, afterName, afterId);
  }

  private static int rebuildAndStore(
      EntityDAO<?> contractDAO, ObjectNode contract, UnaryOperator<EntityReference> lookup) {
    boolean changed = rebuildEntityReference(contract, lookup);
    if (changed) {
      contractDAO.update(
          UUID.fromString(contract.path("id").asText()),
          contract.path("fullyQualifiedName").asText(),
          contract.toString());
    }
    return changed ? 1 : 0;
  }

  static boolean rebuildEntityReference(
      ObjectNode contract, UnaryOperator<EntityReference> lookup) {
    JsonNode stored = contract.get(ENTITY);
    JsonNode rebuilt = stored;
    if (stored != null && stored.hasNonNull("id") && stored.hasNonNull("type")) {
      rebuilt = resolve(stored, lookup, contract.path("fullyQualifiedName").asText());
    }
    boolean changed = rebuilt != null && !rebuilt.equals(stored);
    if (changed) {
      contract.set(ENTITY, rebuilt);
    }
    return changed;
  }

  private static JsonNode resolve(
      JsonNode stored, UnaryOperator<EntityReference> lookup, String contractFqn) {
    JsonNode resolved = stored;
    try {
      EntityReference ref = JsonUtils.treeToValue(stored, EntityReference.class);
      resolved = JsonUtils.valueToTree(lookup.apply(ref));
    } catch (EntityNotFoundException e) {
      LOG.warn("Data contract {} points at a missing entity, leaving it unchanged", contractFqn);
    }
    return resolved;
  }
}
