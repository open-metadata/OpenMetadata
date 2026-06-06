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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.INGESTION_PIPELINE;
import static org.openmetadata.service.util.EntityUtil.objectMatch;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.Getter;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.PropagationDescriptor;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

public abstract class ServiceEntityRepository<
        T extends ServiceEntityInterface, S extends ServiceConnectionEntityInterface>
    extends EntityRepository<T> {
  private static final String PIPELINES_FIELD = "pipelines";

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
  public List<PropagationDescriptor> getSearchPropagationDescriptors() {
    List<PropagationDescriptor> descriptors = new ArrayList<>();
    for (PropagationDescriptor desc : super.getSearchPropagationDescriptors()) {
      if (!desc.fieldName().equals(FIELD_DISPLAY_NAME)) {
        descriptors.add(desc);
      }
    }
    descriptors.add(
        new PropagationDescriptor(
            FIELD_DISPLAY_NAME,
            PropagationDescriptor.PropagationType.NESTED_FIELD,
            "service.displayName"));
    return descriptors;
  }

  @Override
  public void setFields(T entity, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    entity.setPipelines(fields.contains(PIPELINES_FIELD) ? getIngestionPipelines(entity) : null);
  }

  @Override
  public void clearFields(T entity, EntityUtil.Fields fields) {
    if (!fields.contains(PIPELINES_FIELD)) {
      entity.setPipelines(null);
    }
  }

  @Override
  public void setFieldsInBulk(EntityUtil.Fields fields, List<T> entities) {
    if (nullOrEmpty(entities)) {
      return;
    }
    fetchAndSetPipelines(entities, fields);
    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    for (T entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  private void fetchAndSetPipelines(List<T> services, EntityUtil.Fields fields) {
    if (!fields.contains(PIPELINES_FIELD)) {
      return;
    }
    Map<UUID, List<EntityReference>> pipelinesMap = batchFetchPipelines(services);
    for (T service : services) {
      service.setPipelines(pipelinesMap.getOrDefault(service.getId(), new ArrayList<>()));
    }
  }

  private Map<UUID, List<EntityReference>> batchFetchPipelines(List<T> services) {
    Map<UUID, List<EntityReference>> pipelinesMap = new HashMap<>();
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findToBatch(
                entityListToStrings(services),
                Relationship.CONTAINS.ordinal(),
                INGESTION_PIPELINE,
                Include.NON_DELETED);
    Map<UUID, EntityReference> pipelineRefs = batchFetchPipelineRefs(records);
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID serviceId = UUID.fromString(record.getFromId());
      EntityReference ref = pipelineRefs.get(UUID.fromString(record.getToId()));
      if (ref != null) {
        pipelinesMap.computeIfAbsent(serviceId, id -> new ArrayList<>()).add(ref);
      }
    }
    return pipelinesMap;
  }

  private Map<UUID, EntityReference> batchFetchPipelineRefs(
      List<CollectionDAO.EntityRelationshipObject> records) {
    List<UUID> pipelineIds =
        records.stream().map(record -> UUID.fromString(record.getToId())).distinct().toList();
    return Entity.getEntityReferencesByIds(INGESTION_PIPELINE, pipelineIds, Include.NON_DELETED)
        .stream()
        .collect(Collectors.toMap(EntityReference::getId, ref -> ref, (left, right) -> left));
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
    // Direct dao.update skips invalidateCachesAfterStore, so the next read would serve the
    // pre-test-connection JSON from cache. Drop every cached variant for this service.
    EntityCacheInvalidator.invalidateCacheForEntity(
        entityType, serviceId, service.getFullyQualifiedName());
    return service;
  }

  /** Remove the secrets from the secret manager only on hard delete */
  @Override
  protected void postDelete(T service, boolean hardDelete) {
    super.postDelete(service, hardDelete);
    // Only delete secrets on hard delete to allow soft delete to be reversible
    if (hardDelete && service.getConnection() != null) {
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
      compareAndUpdate("connection", this::updateConnection);
      compareAndUpdate("ingestionRunner", this::updateIngestionRunner);
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
        recordChange("ingestionRunner", originalAgentId, updatedAgentId, true);
      }
    }
  }
}
