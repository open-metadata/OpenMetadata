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

package org.openmetadata.service.resources.services;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import javax.ws.rs.core.SecurityContext;
import lombok.Getter;
import org.openmetadata.annotations.utils.AnnotationChecker;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.SecretsUtil;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

public abstract class ServiceEntityResource<
        T extends ServiceEntityInterface,
        R extends ServiceEntityRepository<T, S>,
        S extends ServiceConnectionEntityInterface>
    extends EntityResource<T, R> {

  @Getter private final ServiceEntityRepository<T, S> serviceEntityRepository;

  private final ServiceType serviceType;

  protected ServiceEntityResource(
      Class<T> entityClass, R serviceRepository, Authorizer authorizer, ServiceType serviceType) {
    super(entityClass, serviceRepository, authorizer);
    this.serviceEntityRepository = serviceRepository;
    this.serviceType = serviceType;
  }

  protected T decryptOrNullify(SecurityContext securityContext, T service) {
    if (service.getConnection() != null) {
      service
          .getConnection()
          .setConfig(retrieveServiceConnectionConfig(service, authorizer.shouldMaskPasswords(securityContext)));
    }
    return service;
  }

  private Object retrieveServiceConnectionConfig(T service, boolean maskPassword) {
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

  protected ResultList<T> decryptOrNullify(SecurityContext securityContext, ResultList<T> services) {
    listOrEmpty(services.getData()).forEach(service -> decryptOrNullify(securityContext, service));
    return services;
  }

  protected T nullifyRequiredConnectionParameters(T service) {
    Object connectionConfig = retrieveServiceConnectionConfig(service, true);
    if (AnnotationChecker.isExposedFieldPresent(connectionConfig.getClass())) {
      service.getConnection().setConfig(JsonUtils.toExposedEntity(connectionConfig, connectionConfig.getClass()));
      return service;
    }
    return nullifyConnection(service);
  }

  protected T unmask(T service) {
    serviceEntityRepository.setFullyQualifiedName(service);
    T originalService =
        serviceEntityRepository.findByNameOrNull(service.getFullyQualifiedName(), null, Include.NON_DELETED);
    String connectionType = extractServiceType(service);
    try {
      if (originalService != null && originalService.getConnection() != null) {
        Object serviceConnectionConfig =
            EntityMaskerFactory.getEntityMasker()
                .unmaskServiceConnectionConfig(
                    service.getConnection().getConfig(),
                    originalService.getConnection().getConfig(),
                    connectionType,
                    serviceType);
        service.getConnection().setConfig(serviceConnectionConfig);
      }
      return service;
    } catch (Exception e) {
      String message = SecretsUtil.buildExceptionMessageConnectionMask(e.getMessage(), connectionType, false);
      if (message != null) {
        throw new InvalidServiceConnectionException(message);
      }
      throw InvalidServiceConnectionException.byMessage(
          connectionType, String.format("Failed to unmask connection instance of %s", connectionType));
    }
  }

  protected abstract T nullifyConnection(T service);

  protected abstract String extractServiceType(T service);
}
