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

package org.openmetadata.service.secrets;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.service.exception.SecretsManagerMigrationException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.CollectionRegistry.CollectionDetails;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.util.EntityUtil;

/**
 * Update service using the configured secret manager.
 *
 * <p>- It will update all the services entities with connection parameters
 */
@Slf4j
public class SecretsManagerUpdateService {
  private final SecretsManager secretManager;
  private final SecretsManager oldSecretManager;

  private final Map<Class<? extends ServiceConnectionEntityInterface>, ServiceEntityRepository<?, ?>>
      connectionTypeRepositoriesMap;

  public SecretsManagerUpdateService(SecretsManager secretsManager, String clusterName) {
    this.secretManager = secretsManager;
    this.connectionTypeRepositoriesMap = retrieveConnectionTypeRepositoriesMap();
    // by default, it is going to be non-managed secrets manager since decrypt is the same for all of them
    this.oldSecretManager = SecretsManagerFactory.createSecretsManager(null, clusterName);
  }

  public void updateEntities() {
    updateServices();
  }

  private void updateServices() {
    LOG.info(
        String.format(
            "Checking if services updating is needed for secrets manager: [%s]",
            secretManager.getSecretsManagerProvider().value()));
    List<ServiceEntityInterface> notStoredServices = retrieveServices();
    if (!notStoredServices.isEmpty()) {
      notStoredServices.forEach(this::updateService);
    }
  }

  private void updateService(ServiceEntityInterface serviceEntityInterface) {
    ServiceEntityRepository<?, ?> repository =
        connectionTypeRepositoriesMap.get(serviceEntityInterface.getConnection().getClass());
    try {
      ServiceEntityInterface service = repository.dao.findEntityById(serviceEntityInterface.getId());
      // we have to decrypt using the old secrets manager and encrypt again with the new one
      service
          .getConnection()
          .setConfig(
              oldSecretManager.encryptOrDecryptServiceConnectionConfig(
                  service.getConnection().getConfig(),
                  service.getServiceType().value(),
                  service.getName(),
                  repository.getServiceType(),
                  false));
      service
          .getConnection()
          .setConfig(
              secretManager.encryptOrDecryptServiceConnectionConfig(
                  service.getConnection().getConfig(),
                  service.getServiceType().value(),
                  service.getName(),
                  repository.getServiceType(),
                  true));
      repository.dao.update(service);
    } catch (IOException e) {
      throw new SecretsManagerMigrationException(e.getMessage(), e.getCause());
    }
  }

  private List<ServiceEntityInterface> retrieveServices() {
    return connectionTypeRepositoriesMap.values().stream()
        .map(this::retrieveServices)
        .flatMap(List<ServiceEntityInterface>::stream)
        .collect(Collectors.toList());
  }

  private List<ServiceEntityInterface> retrieveServices(ServiceEntityRepository<?, ?> serviceEntityRepository) {
    try {
      return serviceEntityRepository
          .listAfter(
              null,
              EntityUtil.Fields.EMPTY_FIELDS,
              new ListFilter(),
              serviceEntityRepository.dao.listCount(new ListFilter()),
              null)
          .getData().stream()
          .map(ServiceEntityInterface.class::cast)
          .filter(
              service ->
                  !Objects.isNull(service.getConnection()) && !Objects.isNull(service.getConnection().getConfig()))
          .collect(Collectors.toList());
    } catch (IOException e) {
      throw new SecretsManagerMigrationException(e.getMessage(), e.getCause());
    }
  }

  private Map<Class<? extends ServiceConnectionEntityInterface>, ServiceEntityRepository<?, ?>>
      retrieveConnectionTypeRepositoriesMap() {
    Map<Class<? extends ServiceConnectionEntityInterface>, ServiceEntityRepository<?, ?>>
        connectionTypeRepositoriesMap =
            CollectionRegistry.getInstance().getCollectionMap().values().stream()
                .map(this::retrieveServiceRepository)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .collect(Collectors.toMap(ServiceEntityRepository::getServiceConnectionClass, Function.identity()));
    if (connectionTypeRepositoriesMap.isEmpty()) {
      throw new SecretsManagerMigrationException("Unexpected error: ServiceRepository not found.");
    }
    return connectionTypeRepositoriesMap;
  }

  private Optional<ServiceEntityRepository<?, ?>> retrieveServiceRepository(CollectionDetails collectionDetails) {
    Class<?> collectionDetailsClass = extractCollectionDetailsClass(collectionDetails);
    if (ServiceEntityResource.class.isAssignableFrom(collectionDetailsClass)) {
      return Optional.of(
          ((ServiceEntityResource<?, ?, ?>) collectionDetails.getResource()).getServiceEntityRepository());
    }
    return Optional.empty();
  }

  private Class<?> extractCollectionDetailsClass(CollectionDetails collectionDetails) {
    Class<?> collectionDetailsClass;
    try {
      collectionDetailsClass = Class.forName(collectionDetails.getResourceClass());
    } catch (ClassNotFoundException e) {
      throw new SecretsManagerMigrationException(e.getMessage(), e.getCause());
    }
    return collectionDetailsClass;
  }
}
