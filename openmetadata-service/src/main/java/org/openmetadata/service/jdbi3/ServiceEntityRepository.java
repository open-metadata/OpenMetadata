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

import static org.openmetadata.service.Entity.FIELD_OWNER;
import static org.openmetadata.service.util.EntityUtil.objectMatch;

import java.io.IOException;
import lombok.Getter;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;

public abstract class ServiceEntityRepository<
        T extends ServiceEntityInterface, S extends ServiceConnectionEntityInterface>
    extends EntityRepository<T> {
  private static final String UPDATE_FIELDS = "owner";

  @Getter private final Class<S> serviceConnectionClass;

  protected final SecretsManager secretsManager;

  @Getter private final ServiceType serviceType;

  protected ServiceEntityRepository(
      String collectionPath,
      String service,
      CollectionDAO dao,
      EntityDAO<T> entityDAO,
      SecretsManager secretsManager,
      Class<S> serviceConnectionClass,
      ServiceType serviceType) {
    this(collectionPath, service, dao, entityDAO, secretsManager, serviceConnectionClass, UPDATE_FIELDS, serviceType);
  }

  protected ServiceEntityRepository(
      String collectionPath,
      String service,
      CollectionDAO dao,
      EntityDAO<T> entityDAO,
      SecretsManager secretsManager,
      Class<S> serviceConnectionClass,
      String updatedFields,
      ServiceType serviceType) {
    super(collectionPath, service, entityDAO.getEntityClass(), entityDAO, dao, "", updatedFields);
    this.secretsManager = secretsManager;
    this.serviceConnectionClass = serviceConnectionClass;
    this.serviceType = serviceType;
  }

  @Override
  public T setFields(T entity, EntityUtil.Fields fields) throws IOException {
    entity.setPipelines(fields.contains("pipelines") ? getIngestionPipelines(entity) : null);
    entity.setOwner(fields.contains(FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  @Override
  public void prepare(T service) throws IOException {
    setFullyQualifiedName(service);
  }

  @Override
  public void storeEntity(T service, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = service.getOwner();

    // Don't store owner, service, href and tags as JSON. Build it on the fly based on relationships
    service.withOwner(null).withHref(null);

    // encrypt connection config in case of local secret manager
    if (secretsManager.isLocal()) {
      service
          .getConnection()
          .setConfig(
              secretsManager.encryptOrDecryptServiceConnectionConfig(
                  service.getConnection().getConfig(),
                  service.getServiceType().value(),
                  service.getName(),
                  serviceType,
                  true));
      store(service.getId(), service, update);
    } else {
      // otherwise, nullify the config since it will be kept outside OM
      Object connectionConfig = service.getConnection().getConfig();
      service.getConnection().setConfig(null);
      store(service.getId(), service, update);
      // save connection in the secret manager after storing the service
      service
          .getConnection()
          .setConfig(
              secretsManager.encryptOrDecryptServiceConnectionConfig(
                  connectionConfig, service.getServiceType().value(), service.getName(), serviceType, true));
    }

    // Restore the relationships
    service.withOwner(owner);
  }

  @Override
  public void storeRelationships(T service) {
    // Add owner relationship
    storeOwner(service, service.getOwner());
  }

  @Override
  public ServiceUpdater getUpdater(T original, T updated, Operation operation) {
    return new ServiceUpdater(original, updated, operation);
  }

  public class ServiceUpdater extends EntityUpdater {

    public ServiceUpdater(T original, T updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateConnection();
    }

    private void updateConnection() throws IOException {
      if (secretsManager.isLocal()) {
        ServiceConnectionEntityInterface origConn = original.getConnection();
        ServiceConnectionEntityInterface updatedConn = updated.getConnection();
        String origJson = JsonUtils.pojoToJson(origConn);
        String updatedJson = JsonUtils.pojoToJson(updatedConn);
        S decryptedOrigConn = JsonUtils.readValue(origJson, serviceConnectionClass);
        S decryptedUpdatedConn = JsonUtils.readValue(updatedJson, serviceConnectionClass);
        decryptedOrigConn.setConfig(
            secretsManager.encryptOrDecryptServiceConnectionConfig(
                decryptedOrigConn.getConfig(),
                original.getServiceType().value(),
                original.getName(),
                serviceType,
                false));
        decryptedUpdatedConn.setConfig(
            secretsManager.encryptOrDecryptServiceConnectionConfig(
                decryptedUpdatedConn.getConfig(),
                updated.getServiceType().value(),
                updated.getName(),
                serviceType,
                false));
        if (!objectMatch.test(decryptedOrigConn, decryptedUpdatedConn)) {
          recordChange("connection", origConn, updatedConn, true);
        }
      } else {
        original
            .getConnection()
            .setConfig(
                secretsManager.encryptOrDecryptServiceConnectionConfig(
                    original.getConnection().getConfig(),
                    original.getServiceType().value(),
                    original.getName(),
                    serviceType,
                    false));
        String origJson = JsonUtils.pojoToJson(original.getConnection());
        String updatedJson = JsonUtils.pojoToJson(updated.getConnection());
        original.getConnection().setConfig(null);
        if (!objectMatch.test(origJson, updatedJson)) {
          // we don't want save connection config details in our database in case the secret manager is not local
          recordChange("connection", "old-encrypted-value", "new-encrypted-value", true);
        }
      }
    }
  }
}
