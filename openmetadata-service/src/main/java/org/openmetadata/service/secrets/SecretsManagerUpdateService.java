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
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SecretsManagerUpdateException;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.CollectionRegistry.CollectionDetails;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.util.EntityUtil;

/**
 * Update service using the configured secret manager.
 *
 * <p>- It will update all the services entities with connection parameters
 *
 * <p>- It will update all the user bots with authentication mechanism
 *
 * <p>- It will update all the ingestion pipelines of type metadata with DBT config
 */
@Slf4j
public class SecretsManagerUpdateService {
  private final SecretsManager secretManager;
  private final SecretsManager oldSecretManager;
  private final UserRepository userRepository;
  private final IngestionPipelineRepository ingestionPipelineRepository;

  private final Map<Class<? extends ServiceConnectionEntityInterface>, ServiceEntityRepository<?, ?>>
      connectionTypeRepositoriesMap;

  public SecretsManagerUpdateService(SecretsManager secretsManager, String clusterName) {
    this.secretManager = secretsManager;
    this.connectionTypeRepositoriesMap = retrieveConnectionTypeRepositoriesMap();
    this.userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    this.ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    // by default, it is going to be non-managed secrets manager since decrypt is the same for all of them
    this.oldSecretManager = SecretsManagerFactory.createSecretsManager(null, clusterName);
  }

  public void updateEntities() {
    updateServices();
    updateBotUsers();
    updateIngestionPipelines();
  }

  private void updateServices() {
    LOG.info(
        String.format(
            "Updating services in case of an update on the JSON schema: [%s]",
            secretManager.getSecretsManagerProvider().value()));
    retrieveServices().forEach(this::updateService);
  }

  private void updateBotUsers() {
    LOG.info(
        String.format(
            "Updating bot users in case of an update on the JSON schema: [%s]",
            secretManager.getSecretsManagerProvider().value()));
    retrieveBotUsers().forEach(this::updateBotUser);
  }

  private void updateIngestionPipelines() {
    LOG.info(
        String.format(
            "Updating bot users in case of an update on the JSON schema: [%s]",
            secretManager.getSecretsManagerProvider().value()));
    retrieveIngestionPipelines().forEach(this::updateIngestionPipelines);
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
      throw new SecretsManagerUpdateException(e.getMessage(), e.getCause());
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
      throw new SecretsManagerUpdateException(e.getMessage(), e.getCause());
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
      throw new SecretsManagerUpdateException("Unexpected error: ServiceRepository not found.");
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
      throw new SecretsManagerUpdateException(e.getMessage(), e.getCause());
    }
    return collectionDetailsClass;
  }

  private List<User> retrieveBotUsers() {
    try {
      return userRepository
          .listAfter(
              null,
              new EntityUtil.Fields(List.of("authenticationMechanism")),
              new ListFilter(),
              userRepository.dao.listCount(new ListFilter()),
              null)
          .getData().stream()
          .filter(user -> Boolean.TRUE.equals(user.getIsBot()))
          .collect(Collectors.toList());
    } catch (IOException e) {
      throw new SecretsManagerUpdateException(e.getMessage(), e.getCause());
    }
  }

  private void updateBotUser(User botUser) {
    try {
      User user = userRepository.dao.findEntityById(botUser.getId());
      AuthenticationMechanism authenticationMechanism =
          oldSecretManager.encryptOrDecryptAuthenticationMechanism(
              botUser.getName(), user.getAuthenticationMechanism(), false);
      userRepository.dao.update(
          user.withAuthenticationMechanism(
              secretManager.encryptOrDecryptAuthenticationMechanism(botUser.getName(), authenticationMechanism, true)));
    } catch (IOException e) {
      throw new SecretsManagerUpdateException(e.getMessage(), e.getCause());
    }
  }

  private List<IngestionPipeline> retrieveIngestionPipelines() {
    try {
      return ingestionPipelineRepository
          .listAfter(
              null,
              EntityUtil.Fields.EMPTY_FIELDS,
              new ListFilter(),
              ingestionPipelineRepository.dao.listCount(new ListFilter()),
              null)
          .getData();
    } catch (IOException e) {
      throw new SecretsManagerUpdateException(e.getMessage(), e.getCause());
    }
  }

  private void updateIngestionPipelines(IngestionPipeline ingestionPipeline) {
    try {
      IngestionPipeline ingestion = ingestionPipelineRepository.dao.findEntityById(ingestionPipeline.getId());
      // we have to decrypt using the old secrets manager and encrypt again with the new one
      oldSecretManager.encryptOrDecryptIngestionPipeline(ingestionPipeline, false);
      secretManager.encryptOrDecryptIngestionPipeline(ingestionPipeline, true);
      ingestionPipelineRepository.dao.update(ingestion);
    } catch (IOException e) {
      throw new SecretsManagerUpdateException(e.getMessage(), e.getCause());
    }
  }
}
