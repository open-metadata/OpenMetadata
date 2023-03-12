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

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;

public abstract class ServiceEntityRepository<
        T extends ServiceEntityInterface, S extends ServiceConnectionEntityInterface>
    extends EntityRepository<T> {
  private static final String UPDATE_FIELDS = "owner,tags";
  private static final String PATCH_FIELDS = UPDATE_FIELDS;

  @Getter private final Class<S> serviceConnectionClass;

  @Getter private final ServiceType serviceType;

  protected ServiceEntityRepository(
      String collectionPath,
      String service,
      CollectionDAO dao,
      EntityDAO<T> entityDAO,
      Class<S> serviceConnectionClass,
      ServiceType serviceType) {
    this(collectionPath, service, dao, entityDAO, serviceConnectionClass, UPDATE_FIELDS, serviceType);
  }

  protected ServiceEntityRepository(
      String collectionPath,
      String service,
      CollectionDAO dao,
      EntityDAO<T> entityDAO,
      Class<S> serviceConnectionClass,
      String updatedFields,
      ServiceType serviceType) {
    super(collectionPath, service, entityDAO.getEntityClass(), entityDAO, dao, PATCH_FIELDS, updatedFields);
    this.serviceConnectionClass = serviceConnectionClass;
    this.serviceType = serviceType;
  }

  @Override
  public T setFields(T entity, EntityUtil.Fields fields) throws IOException {
    entity.setPipelines(fields.contains("pipelines") ? getIngestionPipelines(entity) : null);
    return entity;
  }

  @Override
  public void prepare(T service) {
    /* Nothing to do */
    service
        .getConnection()
        .setConfig(
            SecretsManagerFactory.getSecretsManager()
                .encryptOrDecryptServiceConnectionConfig(
                    service.getConnection().getConfig(),
                    service.getServiceType().value(),
                    service.getName(),
                    serviceType,
                    true));
  }

  @Override
  public void storeEntity(T service, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = service.getOwner();
    List<TagLabel> tags = service.getTags();
    // Don't store owner, service, href and tags as JSON. Build it on the fly based on relationships
    service.withOwner(null).withHref(null).setTags(null);
    store(service, update);
    // Restore the relationships
    service.withOwner(owner).setTags(tags);
  }

  @Override
  public void storeRelationships(T service) {
    // Add owner relationship
    storeOwner(service, service.getOwner());
    // add tags relationship
    applyTags(service);
  }

  public T addTestConnectionResult(UUID serviceId, TestConnectionResult testConnectionResult) throws IOException {
    T service = dao.findEntityById(serviceId);
    service.setTestConnectionResult(testConnectionResult);
    dao.update(serviceId, JsonUtils.pojoToJson(service));
    return service;
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
      ServiceConnectionEntityInterface origConn = original.getConnection();
      ServiceConnectionEntityInterface updatedConn = updated.getConnection();
      String origJson = JsonUtils.pojoToJson(origConn);
      String updatedJson = JsonUtils.pojoToJson(updatedConn);
      S decryptedOrigConn = JsonUtils.readValue(origJson, serviceConnectionClass);
      S decryptedUpdatedConn = JsonUtils.readValue(updatedJson, serviceConnectionClass);
      SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
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
        // we don't want save connection config details in our database
        recordChange("connection", "old-encrypted-value", "new-encrypted-value", true);
      }
    }
  }
}
