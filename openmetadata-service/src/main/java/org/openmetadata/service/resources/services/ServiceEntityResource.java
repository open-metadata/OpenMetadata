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

import java.io.IOException;
import javax.ws.rs.core.SecurityContext;
import lombok.Getter;
import org.openmetadata.annotations.utils.AnnotationChecker;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
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
    if (!authorizer.decryptSecret(securityContext)) {
      return nullifyRequiredConnectionParameters(service);
    }
    service
        .getConnection()
        .setConfig(retrieveServiceConnectionConfig(service, authorizer.maskPasswords(securityContext)));
    return service;
  }

  private Object retrieveServiceConnectionConfig(T service, boolean maskPassword) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    Object config =
        secretsManager.encryptOrDecryptServiceConnectionConfig(
            service.getConnection().getConfig(), extractServiceType(service), service.getName(), serviceType, false);
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
      try {
        service.getConnection().setConfig(JsonUtils.toExposedEntity(connectionConfig, connectionConfig.getClass()));
        return service;
      } catch (IOException e) {
        throw new UnhandledServerException(e.getMessage(), e.getCause());
      }
    }
    return nullifyConnection(service);
  }

  protected T unmask(T service) {
    serviceEntityRepository.setFullyQualifiedName(service);
    T originalService =
        serviceEntityRepository.findByNameOrNull(service.getFullyQualifiedName(), null, Include.NON_DELETED);
    if (originalService != null && originalService.getConnection() != null) {
      Object serviceConnectionConfig =
          EntityMaskerFactory.getEntityMasker()
              .unmaskServiceConnectionConfig(
                  service.getConnection().getConfig(),
                  originalService.getConnection().getConfig(),
                  extractServiceType(service),
                  serviceType);
      service.getConnection().setConfig(serviceConnectionConfig);
    }
    return service;
  }

  protected abstract T nullifyConnection(T service);

  protected abstract String extractServiceType(T service);
}
