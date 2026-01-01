/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.services.serviceentities;

import jakarta.ws.rs.core.SecurityContext;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;

/**
 * Abstract base class for service entity services (DatabaseService, DashboardService, etc.).
 *
 * <p>Extends AbstractEntityService to inherit standard CRUD operations and adds service-specific
 * functionality like connection encryption/decryption and test connection handling.
 *
 * @param <T> The service entity type implementing ServiceEntityInterface
 * @param <R> The service entity repository type
 * @param <S> The service connection configuration type
 */
@Slf4j
public abstract class AbstractServiceEntityService<
        T extends ServiceEntityInterface,
        R extends ServiceEntityRepository<T, S>,
        S extends ServiceConnectionEntityInterface>
    extends AbstractEntityService<T> {

  protected final R serviceRepository;
  protected final ServiceType serviceType;

  protected AbstractServiceEntityService(
      R repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      String entityType,
      ServiceType serviceType) {
    super(repository, searchRepository, authorizer, entityType);
    this.serviceRepository = repository;
    this.serviceType = serviceType;
  }

  /**
   * Decrypt the service connection or nullify/mask based on user permissions.
   *
   * @param securityContext Security context for permission check
   * @param service The service entity
   * @return Service with decrypted or masked connection
   */
  public T decryptOrNullify(SecurityContext securityContext, T service) {
    if (service.getConnection() != null) {
      service
          .getConnection()
          .setConfig(
              retrieveServiceConnectionConfig(
                  service, authorizer.shouldMaskPasswords(securityContext)));
    }
    return service;
  }

  /**
   * Retrieve and optionally mask the service connection config.
   *
   * @param service The service entity
   * @param maskPassword Whether to mask password fields
   * @return Decrypted and optionally masked connection config
   */
  protected Object retrieveServiceConnectionConfig(T service, boolean maskPassword) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    Object config =
        secretsManager.decryptServiceConnectionConfig(
            service.getConnection().getConfig(), extractServiceType(service), serviceType);
    if (maskPassword) {
      config =
          EntityMaskerFactory.getEntityMasker()
              .maskServiceConnectionConfig(config, extractServiceType(service), serviceType);
    }
    return config;
  }

  /**
   * Add test connection result to the service.
   *
   * @param serviceId Service ID
   * @param testConnectionResult Test connection result
   * @return Updated service entity
   */
  public T addTestConnectionResult(UUID serviceId, TestConnectionResult testConnectionResult) {
    return serviceRepository.addTestConnectionResult(serviceId, testConnectionResult);
  }

  /**
   * Extract the service type string from the service entity.
   *
   * @param service The service entity
   * @return Service type string
   */
  protected abstract String extractServiceType(T service);

  /**
   * Get the service type.
   *
   * @return Service type
   */
  public ServiceType getServiceType() {
    return serviceType;
  }
}
