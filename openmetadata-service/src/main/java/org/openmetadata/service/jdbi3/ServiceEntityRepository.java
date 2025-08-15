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
package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.util.EntityUtil.objectMatch;

import java.util.Objects;
import java.util.UUID;
import lombok.Getter;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil;

public abstract class ServiceEntityRepository<
        T extends ServiceEntityInterface, S extends ServiceConnectionEntityInterface>
    extends EntityRepository<T> {
  @Getter private final Class<S> serviceConnectionClass;
  @Getter private final ServiceType serviceType;

  protected ServiceEntityRepository(
      String collectionPath,
      String service,
      EntityDAO<T> entityDAO,
      Class<S> serviceConnectionClass,
      String updateFields,
      ServiceType serviceType) {
    super(collectionPath, service, entityDAO.getEntityClass(), entityDAO, "", updateFields);
    this.serviceConnectionClass = serviceConnectionClass;
    this.serviceType = serviceType;
    quoteFqn = true;
  }

  @Override
  public void setFields(T entity, EntityUtil.Fields fields) {
    entity.setPipelines(fields.contains("pipelines") ? getIngestionPipelines(entity) : null);
  }

  @Override
  public void clearFields(T entity, EntityUtil.Fields fields) {
    if (!fields.contains("pipelines")) {
      entity.setPipelines(null);
    }
  }

  @Override
  public void prepare(T service, boolean update) {
    if (service.getConnection() != null) {
      service
          .getConnection()
          .setConfig(
              SecretsManagerFactory.getSecretsManager()
                  .encryptServiceConnectionConfig(
                      service.getConnection().getConfig(),
                      service.getServiceType().value(),
                      service.getName(),
                      serviceType));
    }
  }

  @Override
  public void storeEntity(T service, boolean update) {
    store(service, update);
  }

  @Override
  public void storeRelationships(T service) {
    addIngestionRunnerRelationship(service);
  }

  private void addIngestionRunnerRelationship(T service) {
    if (service.getIngestionRunner() != null) {
      addRelationship(
          service.getId(),
          service.getIngestionRunner().getId(),
          entityType,
          service.getIngestionRunner().getType(),
          Relationship.USES);
    }
  }

  public T addTestConnectionResult(UUID serviceId, TestConnectionResult testConnectionResult) {
    T service = find(serviceId, Include.NON_DELETED);
    service.setTestConnectionResult(testConnectionResult);
    dao.update(serviceId, service.getFullyQualifiedName(), JsonUtils.pojoToJson(service));
    return service;
  }

  /** Remove the secrets from the secret manager */
  @Override
  protected void postDelete(T service, boolean hardDelete) {
    super.postDelete(service, hardDelete);
    if (service.getConnection() != null) {
      SecretsManagerFactory.getSecretsManager()
          .deleteSecretsFromServiceConnectionConfig(
              service.getConnection().getConfig(),
              service.getServiceType().value(),
              service.getName(),
              serviceType);
    }
  }

  @Override
  public EntityRepository<T>.EntityUpdater getUpdater(
      T original, T updated, Operation operation, ChangeSource changeSource) {
    return new ServiceUpdater(original, updated, operation);
  }

  public class ServiceUpdater extends EntityUpdater {

    public ServiceUpdater(T original, T updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateConnection();
      updateIngestionRunner();
    }

    private void updateConnection() {
      ServiceConnectionEntityInterface origConn = original.getConnection();
      ServiceConnectionEntityInterface updatedConn = updated.getConnection();
      if (!CommonUtil.nullOrEmpty(updatedConn)) {
        // We check if the updatedConn is null or empty
        String origJson = JsonUtils.pojoToJson(origConn);
        String updatedJson = JsonUtils.pojoToJson(updatedConn);
        S decryptedOrigConn = JsonUtils.readValue(origJson, serviceConnectionClass);
        S decryptedUpdatedConn = JsonUtils.readValue(updatedJson, serviceConnectionClass);
        SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
        if (!CommonUtil.nullOrEmpty(decryptedOrigConn)) {
          // Only decrypt the original connection if it is not null or empty
          decryptedOrigConn.setConfig(
              secretsManager.decryptServiceConnectionConfig(
                  decryptedOrigConn.getConfig(), original.getServiceType().value(), serviceType));
        }

        decryptedUpdatedConn.setConfig(
            secretsManager.decryptServiceConnectionConfig(
                decryptedUpdatedConn.getConfig(), updated.getServiceType().value(), serviceType));
        // we don't want save connection config details in our database
        if (CommonUtil.nullOrEmpty(decryptedOrigConn)
                && !CommonUtil.nullOrEmpty(decryptedUpdatedConn)
            || !objectMatch.test(decryptedOrigConn, decryptedUpdatedConn)) {

          // if Original connection is null or empty and updated connection is not null or empty
          // or if the connection details are different

          recordChange("connection", "old-encrypted-value", "new-encrypted-value", true);
        }
      }
    }

    private void updateIngestionRunner() {
      UUID originalAgentId =
          original.getIngestionRunner() != null ? original.getIngestionRunner().getId() : null;
      UUID updatedAgentId =
          updated.getIngestionRunner() != null ? updated.getIngestionRunner().getId() : null;
      if (!Objects.equals(originalAgentId, updatedAgentId)) {
        addIngestionRunnerRelationship(updated);
        recordChange("ingestionAgent", originalAgentId, updatedAgentId, true);
      }
    }
  }
}
