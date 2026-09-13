/*
 *  Copyright 2022 Collate
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
package org.openmetadata.service.entity.service;

import static org.openmetadata.service.util.EntityUtil.objectMatch;

import java.util.Objects;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.secrets.SecretsManager;

public final class EntityServiceMutation<
        T extends ServiceEntityInterface, S extends ServiceConnectionEntityInterface>
    implements EntitySpecificMutation<T> {

  @Transaction
  @Override
  public void update(EntityUpdater<T> entityUpdate, boolean consolidatingChanges) {
    entityUpdate.compareAndUpdate("connection", () -> updateConnection(entityUpdate));
    entityUpdate.compareAndUpdate("ingestionRunner", () -> updateIngestionRunner(entityUpdate));
  }

  private void updateConnection(EntityUpdater<T> entityUpdate) {
    ServiceConnectionEntityInterface origConn = entityUpdate.getOriginal().getConnection();
    ServiceConnectionEntityInterface updatedConn = entityUpdate.getUpdated().getConnection();
    if (!CommonUtil.nullOrEmpty(updatedConn)) {
      // We check if the updatedConn is null or empty
      String origJson = JsonUtils.pojoToJson(origConn);
      String updatedJson = JsonUtils.pojoToJson(updatedConn);
      S decryptedOrigConn = JsonUtils.readValue(origJson, definition.connectionClass());
      S decryptedUpdatedConn = JsonUtils.readValue(updatedJson, definition.connectionClass());
      SecretsManager secretsManager = secrets.get();
      if (!CommonUtil.nullOrEmpty(decryptedOrigConn)) {
        // Only decrypt the original connection if it is not null or empty
        decryptedOrigConn.setConfig(
            secretsManager.decryptServiceConnectionConfig(
                decryptedOrigConn.getConfig(),
                entityUpdate.getOriginal().getServiceType().value(),
                definition.serviceType()));
      }
      decryptedUpdatedConn.setConfig(
          secretsManager.decryptServiceConnectionConfig(
              decryptedUpdatedConn.getConfig(),
              entityUpdate.getUpdated().getServiceType().value(),
              definition.serviceType()));
      // we don't want save connection config details in our database
      if (CommonUtil.nullOrEmpty(decryptedOrigConn) && !CommonUtil.nullOrEmpty(decryptedUpdatedConn)
          || !objectMatch.test(decryptedOrigConn, decryptedUpdatedConn)) {
        // if Original connection is null or empty and updated connection is not null or empty
        // or if the connection details are different
        entityUpdate.recordChange("connection", "old-encrypted-value", "new-encrypted-value", true);
      }
    }
  }

  private void updateIngestionRunner(EntityUpdater<T> entityUpdate) {
    UUID originalAgentId =
        entityUpdate.getOriginal().getIngestionRunner() != null
            ? entityUpdate.getOriginal().getIngestionRunner().getId()
            : null;
    UUID updatedAgentId =
        entityUpdate.getUpdated().getIngestionRunner() != null
            ? entityUpdate.getUpdated().getIngestionRunner().getId()
            : null;
    if (!Objects.equals(originalAgentId, updatedAgentId)) {
      if (originalAgentId != null) {
        relationships
            .writer()
            .delete(
                new EntityRelationshipWriter.Edge(
                    entityUpdate.getUpdated().getId(),
                    originalAgentId,
                    relationships.entityType(),
                    entityUpdate.getOriginal().getIngestionRunner().getType(),
                    Relationship.USES));
      }
      relationships.add().accept(entityUpdate.getUpdated());
      entityUpdate.recordChange("ingestionRunner", originalAgentId, updatedAgentId, true);
    }
  }

  public record Relationships<T extends ServiceEntityInterface>(
      String entityType, EntityRelationshipWriter writer, Consumer<T> add) {}

  private final EntityServiceOperations.Definition<S> definition;

  private final Supplier<SecretsManager> secrets;

  private final Relationships<T> relationships;

  public EntityServiceMutation(
      EntityServiceOperations.Definition<S> definition,
      Supplier<SecretsManager> secrets,
      Relationships<T> relationships) {
    this.definition = definition;
    this.secrets = secrets;
    this.relationships = relationships;
  }
}
