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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_STYLE;
import static org.openmetadata.service.Entity.INGESTION_PIPELINE;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.Getter;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.cache.EntityCacheInvalidation;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.PropagationDescriptor;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.masker.EntityMasker;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

public final class EntityServiceOperations<
    T extends ServiceEntityInterface, S extends ServiceConnectionEntityInterface> {

  public List<PropagationDescriptor> getSearchPropagationDescriptors(
      List<PropagationDescriptor> inherited) {
    List<PropagationDescriptor> descriptors = new ArrayList<>();
    for (PropagationDescriptor desc : inherited) {
      if (!desc.fieldName().equals(FIELD_DISPLAY_NAME)) {
        descriptors.add(desc);
      }
    }
    descriptors.add(
        new PropagationDescriptor(
            FIELD_DISPLAY_NAME,
            PropagationDescriptor.PropagationType.NESTED_FIELD,
            "service.displayName"));
    if (policy.context().supports(Entity.FIELD_STYLE)) {
      descriptors.add(
          new PropagationDescriptor(
              FIELD_STYLE, PropagationDescriptor.PropagationType.EXTERNAL_HANDLER, null));
    }
    return descriptors;
  }

  public void setFields(T entity, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    entity.setPipelines(
        fields.contains(PIPELINES_FIELD) ? policy.getIngestionPipelines(entity) : null);
  }

  public void clearFields(T entity, EntityUtil.Fields fields) {
    if (!fields.contains(PIPELINES_FIELD)) {
      entity.setPipelines(null);
    }
  }

  public void setFieldsInBulk(EntityUtil.Fields fields, List<T> entities) {
    if (nullOrEmpty(entities)) {
      return;
    }
    fetchAndSetPipelines(entities, fields);
    policy.fieldLoading().populate(entities, fields);
    policy.setInheritedFields(entities, fields);
    for (T entity : entities) {
      policy.clearFieldsInternal(entity, fields);
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
        policy
            .context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findToBatch(
                policy.entityListToStrings(services),
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
    return infrastructure.pipelines().apply(pipelineIds).stream()
        .collect(Collectors.toMap(EntityReference::getId, ref -> ref, (left, right) -> left));
  }

  public void prepare(T service, boolean update) {
    if (service.getConnection() != null) {
      service
          .getConnection()
          .setConfig(
              infrastructure
                  .secrets()
                  .get()
                  .encryptServiceConnectionConfig(
                      service.getConnection().getConfig(),
                      service.getServiceType().value(),
                      service.getName(),
                      definition.serviceType()));
    }
  }

  public T restorePatchSecrets(T original, T updated) {
    if (original.getConnection() != null && updated.getConnection() != null) {
      Object restoredConfig =
          infrastructure
              .masker()
              .get()
              .unmaskServiceConnectionConfig(
                  updated.getConnection().getConfig(),
                  original.getConnection().getConfig(),
                  updated.getServiceType().value(),
                  definition.serviceType());
      updated.getConnection().setConfig(restoredConfig);
    }
    return updated;
  }

  public void storeEntity(T service, boolean update) {
    policy.persistence().store(service, update);
  }

  public void storeRelationships(T service) {
    addIngestionRunnerRelationship(service);
  }

  private void addIngestionRunnerRelationship(T service) {
    if (service.getIngestionRunner() != null) {
      policy
          .relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  service.getId(),
                  service.getIngestionRunner().getId(),
                  policy.context().schema().entityType(),
                  service.getIngestionRunner().getType(),
                  Relationship.USES),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  public T addTestConnectionResult(UUID serviceId, TestConnectionResult testConnectionResult) {
    T service = policy.lookup().byId(serviceId, Include.NON_DELETED);
    service.setTestConnectionResult(testConnectionResult);
    policy
        .context()
        .schema()
        .dao()
        .update(serviceId, service.getFullyQualifiedName(), JsonUtils.pojoToJson(service));
    // Direct dao.update skips invalidateCachesAfterStore, so the next read would serve the
    // pre-test-connection JSON from cache. Drop every cached variant for this service.
    infrastructure
        .invalidations()
        .referencesChanged(
            policy.context().schema().entityType(), serviceId, service.getFullyQualifiedName());
    return service;
  }

  /**
   * Remove the secrets from the secret manager only on hard delete
   */
  public void postDelete(T service, boolean hardDelete) {
    // Only delete secrets on hard delete to allow soft delete to be reversible
    if (hardDelete && service.getConnection() != null) {
      infrastructure
          .secrets()
          .get()
          .deleteSecretsFromServiceConnectionConfig(
              service.getConnection().getConfig(),
              service.getServiceType().value(),
              service.getName(),
              definition.serviceType());
    }
  }

  private static final String PIPELINES_FIELD = "pipelines";

  public record Definition<S extends ServiceConnectionEntityInterface>(
      Class<S> connectionClass, ServiceType serviceType) {}

  public record Infrastructure(
      Supplier<SecretsManager> secrets,
      Supplier<EntityMasker> masker,
      EntityCacheInvalidation invalidations,
      Function<List<UUID>, List<EntityReference>> pipelines) {}

  private final EntityServicePolicy<T, S> policy;

  @Getter private final Definition<S> definition;

  private final Infrastructure infrastructure;

  private final EntityServiceMutation<T, S> mutation;

  public EntityServiceOperations(
      EntityServicePolicy<T, S> policy, Definition<S> definition, Infrastructure infrastructure) {
    this.policy = policy;
    this.definition = definition;
    this.infrastructure = infrastructure;
    this.mutation =
        new EntityServiceMutation<>(
            definition,
            infrastructure.secrets(),
            new EntityServiceMutation.Relationships<>(
                policy.context().schema().entityType(),
                policy.relationshipWrites(),
                this::addIngestionRunnerRelationship));
  }

  public EntityServiceMutation<T, S> mutation() {
    return mutation;
  }
}
