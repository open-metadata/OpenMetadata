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
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SecretsManagerMigrationException;
import org.openmetadata.service.jdbi3.ChangeEventRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.CollectionRegistry.CollectionDetails;
import org.openmetadata.service.resources.events.EventResource;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.util.EntityUtil;

/**
 * Migration service from LocalSecretManager to configured one.
 *
 * <p>It will migrate all the entities with connection parameters:
 *
 * <p>- the connection config objects of services entities which implement the ServiceEntityResource and
 * ServiceEntityRepository (services using the secrets' manager)
 *
 * <p>- remove the auth security config in the IngestionPipeline entities
 *
 * <p>- remove all the ChangeEvent entities related to ingestion pipelines and services
 */
@Slf4j
public class SecretsManagerMigrationService {
  private final SecretsManager newSecretManager;

  private final SecretsManager oldSecretManager;

  private final Map<Class<? extends ServiceConnectionEntityInterface>, ServiceEntityRepository<?, ?>>
      connectionTypeRepositoriesMap;

  private final ChangeEventRepository changeEventRepository;

  private final EntityRepository<IngestionPipeline> ingestionPipelineRepository;

  private final EntityRepository<User> userRepository;

  public SecretsManagerMigrationService(SecretsManager secretsManager, String clusterName) {
    this.newSecretManager = secretsManager;
    this.connectionTypeRepositoriesMap = retrieveConnectionTypeRepositoriesMap();
    this.changeEventRepository = retrieveChangeEventRepository();
    this.ingestionPipelineRepository = Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    this.userRepository = Entity.getEntityRepository(Entity.USER);
    // by default, it is going to be LOCAL
    this.oldSecretManager = SecretsManagerFactory.createSecretsManager(null, clusterName);
  }

  public void migrateServicesToSecretManagerIfNeeded() {
    if (!newSecretManager.isLocal()) {
      migrateServices();
      migrateIngestionPipelines();
      migrateBotUsersCredentials();
    } else {
      LOG.info("Local secrets manager does not need to check if migration is needed.");
    }
  }

  private void migrateBotUsersCredentials() {
    LOG.info(
        String.format(
            "Checking if bot users credentials migration is needed for secrets manager: [%s]",
            newSecretManager.getSecretsManagerProvider().value()));
    List<User> notStoredUsers = retrieveNotStoredUsers();
    if (!notStoredUsers.isEmpty()) {
      notStoredUsers.forEach(this::migrateBotUser);
      deleteChangeEventsFor(Entity.USER);
    } else {
      LOG.info(
          String.format(
              "All bot users credentials are already safely stored in [%s] secrets manager",
              newSecretManager.getSecretsManagerProvider().value()));
    }
  }

  private void migrateServices() {
    LOG.info(
        String.format(
            "Checking if services migration is needed for secrets manager: [%s]",
            newSecretManager.getSecretsManagerProvider().value()));
    List<ServiceEntityInterface> notStoredServices = retrieveNotStoredServices();
    if (!notStoredServices.isEmpty()) {
      notStoredServices.forEach(this::migrateService);
      deleteChangeEventsForServices();
    } else {
      LOG.info(
          String.format(
              "All services are already safely stored in [%s] secrets manager",
              newSecretManager.getSecretsManagerProvider().value()));
    }
  }

  private void migrateIngestionPipelines() {
    LOG.info(
        String.format(
            "Checking if ingestion pipelines migration is needed for secrets manager: [%s]",
            newSecretManager.getSecretsManagerProvider().value()));
    List<IngestionPipeline> notStoredIngestionPipelines = retrieveNotStoredIngestionPipelines();
    if (!notStoredIngestionPipelines.isEmpty()) {
      notStoredIngestionPipelines.forEach(this::migrateIngestionPipelines);
      deleteChangeEventsFor(Entity.INGESTION_PIPELINE);
    } else {
      LOG.info(
          String.format(
              "All ingestion pipelines are already safely stored in [%s] secrets manager",
              newSecretManager.getSecretsManagerProvider().value()));
    }
  }

  private void migrateService(ServiceEntityInterface serviceEntityInterface) {
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
              newSecretManager.encryptOrDecryptServiceConnectionConfig(
                  service.getConnection().getConfig(),
                  service.getServiceType().value(),
                  service.getName(),
                  repository.getServiceType(),
                  true));
      // avoid reaching secrets manager quotas
      Thread.sleep(100);
      repository.dao.update(service);
    } catch (IOException | InterruptedException e) {
      throw new SecretsManagerMigrationException(e.getMessage(), e.getCause());
    }
  }

  private List<ServiceEntityInterface> retrieveNotStoredServices() {
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

  private void migrateIngestionPipelines(IngestionPipeline ingestionPipeline) {
    try {
      IngestionPipeline ingestion = ingestionPipelineRepository.dao.findEntityById(ingestionPipeline.getId());
      if (hasSecurityConfig(ingestionPipeline)) {
        ingestion.getOpenMetadataServerConnection().setSecurityConfig(null);
      }
      if (hasDbtConfig(ingestionPipeline)) {
        // we have to decrypt using the old secrets manager and encrypt again with the new one
        oldSecretManager.encryptOrDecryptDbtConfigSource(ingestionPipeline, false);
        newSecretManager.encryptOrDecryptDbtConfigSource(ingestionPipeline, true);
      }
      ingestionPipelineRepository.dao.update(ingestion);
    } catch (IOException e) {
      throw new SecretsManagerMigrationException(e.getMessage(), e.getCause());
    }
  }

  private List<IngestionPipeline> retrieveNotStoredIngestionPipelines() {
    try {
      return ingestionPipelineRepository
          .listAfter(
              null,
              EntityUtil.Fields.EMPTY_FIELDS,
              new ListFilter(),
              ingestionPipelineRepository.dao.listCount(new ListFilter()),
              null)
          .getData().stream()
          .filter(ingestionPipeline -> hasSecurityConfig(ingestionPipeline) || hasDbtConfig(ingestionPipeline))
          .collect(Collectors.toList());
    } catch (IOException e) {
      throw new SecretsManagerMigrationException(e.getMessage(), e.getCause());
    }
  }

  private void migrateBotUser(User botUser) {
    try {
      User user = userRepository.dao.findEntityById(botUser.getId());

      Object authConfig =
          oldSecretManager.encryptOrDecryptBotUserCredentials(
              botUser.getName(), user.getAuthenticationMechanism().getConfig(), false);
      authConfig = newSecretManager.encryptOrDecryptBotUserCredentials(botUser.getName(), authConfig, true);

      user.getAuthenticationMechanism().setConfig(authConfig);

      userRepository.dao.update(user);
    } catch (IOException e) {
      throw new SecretsManagerMigrationException(e.getMessage(), e.getCause());
    }
  }

  private List<User> retrieveNotStoredUsers() {
    try {
      return userRepository
          .listAfter(
              null,
              new EntityUtil.Fields(List.of("authenticationMechanism")),
              new ListFilter(),
              userRepository.dao.listCount(new ListFilter()),
              null)
          .getData().stream()
          .filter(this::isBotWithCredentials)
          .collect(Collectors.toList());
    } catch (IOException e) {
      throw new SecretsManagerMigrationException(e.getMessage(), e.getCause());
    }
  }

  private boolean isBotWithCredentials(User user) {
    return Boolean.TRUE.equals(user.getIsBot())
        && user.getAuthenticationMechanism() != null
        && user.getAuthenticationMechanism().getConfig() != null;
  }

  private boolean hasSecurityConfig(IngestionPipeline ingestionPipeline) {
    return !Objects.isNull(ingestionPipeline.getOpenMetadataServerConnection())
        && !Objects.isNull(ingestionPipeline.getOpenMetadataServerConnection().getSecurityConfig());
  }

  private boolean hasDbtConfig(IngestionPipeline ingestionPipeline) {
    return ingestionPipeline.getService().getType().equals(Entity.DATABASE_SERVICE)
        && ingestionPipeline.getPipelineType().equals(PipelineType.METADATA);
  }

  /** This method delete all the change events which could contain connection config parameters for services */
  private void deleteChangeEventsForServices() {
    connectionTypeRepositoriesMap.values().stream()
        .map(ServiceEntityRepository::getServiceType)
        .forEach(
            serviceType -> {
              try {
                deleteChangeEventsFor(
                    Entity.class
                        .getField(serviceType.value().toUpperCase(Locale.ROOT) + "_SERVICE")
                        .get(Entity.class)
                        .toString());
              } catch (NoSuchFieldException | IllegalAccessException e) {
                throw new SecretsManagerMigrationException(e.getMessage(), e.getCause());
              }
            });
  }

  /**
   * This method delete all the change events which could contain auth provider config parameters for ingestion
   * pipelines
   */
  private void deleteChangeEventsFor(String entityType) {
    changeEventRepository.deleteAll(entityType);
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

  private ChangeEventRepository retrieveChangeEventRepository() {
    return CollectionRegistry.getInstance().getCollectionMap().values().stream()
        .map(collectionDetails -> retrieveResource(collectionDetails, EventResource.class))
        .filter(Optional::isPresent)
        .map(res -> res.get().getDao())
        .findFirst()
        .orElseThrow(() -> new SecretsManagerMigrationException("Unexpected error: ChangeEventRepository not found."));
  }

  private <T> Optional<T> retrieveResource(CollectionDetails collectionDetails, Class<T> clazz) {
    Class<?> collectionDetailsClass = extractCollectionDetailsClass(collectionDetails);
    if (clazz.equals(collectionDetailsClass)) {
      return Optional.of(clazz.cast(collectionDetails.getResource()));
    }
    return Optional.empty();
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
