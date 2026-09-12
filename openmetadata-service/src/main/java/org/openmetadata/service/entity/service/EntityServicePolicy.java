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

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.search.PropagationDescriptor;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

public interface EntityServicePolicy<
        T extends ServiceEntityInterface, S extends ServiceConnectionEntityInterface>
    extends EntityPolicy<T> {

  EntityServiceOperations<T, S> serviceOperations();

  default Class<S> getServiceConnectionClass() {
    return serviceOperations().getDefinition().connectionClass();
  }

  default ServiceType getServiceType() {
    return serviceOperations().getDefinition().serviceType();
  }

  @Override
  public default List<PropagationDescriptor> getSearchPropagationDescriptors() {
    return serviceOperations()
        .getSearchPropagationDescriptors(EntityPolicy.super.getSearchPropagationDescriptors());
  }

  @Override
  public default void setFields(
      T entity, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    serviceOperations().setFields(entity, fields, relationIncludes);
  }

  @Override
  public default void clearFields(T entity, EntityUtil.Fields fields) {
    serviceOperations().clearFields(entity, fields);
  }

  @Override
  public default void setFieldsInBulk(EntityUtil.Fields fields, List<T> entities) {
    serviceOperations().setFieldsInBulk(fields, entities);
  }

  @Override
  public default void prepare(T service, boolean update) {
    serviceOperations().prepare(service, update);
  }

  @Override
  public default T restorePatchSecrets(T original, T updated) {
    return serviceOperations().restorePatchSecrets(original, updated);
  }

  @Override
  public default void storeEntity(T service, boolean update) {
    serviceOperations().storeEntity(service, update);
  }

  @Override
  public default void storeRelationships(T service) {
    serviceOperations().storeRelationships(service);
  }

  public default T addTestConnectionResult(
      UUID serviceId, TestConnectionResult testConnectionResult) {
    return serviceOperations().addTestConnectionResult(serviceId, testConnectionResult);
  }

  /**
   * Remove the secrets from the secret manager only on hard delete
   */
  @Override
  public default void postDelete(T service, boolean hardDelete) {
    EntityPolicy.super.postDelete(service, hardDelete);
    serviceOperations().postDelete(service, hardDelete);
  }

  @Override
  public default EntityUpdater<T> getUpdater(
      T original, T updated, EntityOperation operation, ChangeSource changeSource) {
    return new EntityUpdater<>(
        context().services().getUpdaterServices(),
        new EntityUpdateRequest<>(original, updated, operation, null, false),
        serviceOperations().mutation());
  }
}
