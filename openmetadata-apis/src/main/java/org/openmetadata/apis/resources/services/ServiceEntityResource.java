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

package org.openmetadata.apis.resources.services;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import javax.ws.rs.core.SecurityContext;
import lombok.Getter;
import org.openmetadata.annotations.utils.AnnotationChecker;
import org.openmetadata.apis.exception.UnhandledServerException;
import org.openmetadata.apis.jdbi3.ServiceEntityRepository;
import org.openmetadata.apis.resources.EntityResource;
import org.openmetadata.apis.secrets.SecretsManager;
import org.openmetadata.apis.security.AuthorizationException;
import org.openmetadata.apis.security.Authorizer;
import org.openmetadata.apis.util.JsonUtils;
import org.openmetadata.apis.util.ResultList;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;

public abstract class ServiceEntityResource<
        T extends ServiceEntityInterface,
        R extends ServiceEntityRepository<T, S>,
        S extends ServiceConnectionEntityInterface>
    extends EntityResource<T, R> {

  private final SecretsManager secretsManager;

  @Getter private final ServiceEntityRepository<T, S> serviceEntityRepository;

  private final ServiceType serviceType;

  protected ServiceEntityResource(
      Class<T> entityClass,
      R serviceRepository,
      Authorizer authorizer,
      SecretsManager secretsManager,
      ServiceType serviceType) {
    super(entityClass, serviceRepository, authorizer);
    this.serviceEntityRepository = serviceRepository;
    this.secretsManager = secretsManager;
    this.serviceType = serviceType;
  }

  protected T decryptOrNullify(SecurityContext securityContext, T service) {
    try {
      authorizer.authorizeAdmin(securityContext, secretsManager.isLocal());
    } catch (AuthorizationException e) {
      return nullifyRequiredConnectionParameters(service);
    }
    service.getConnection().setConfig(retrieveServiceConnectionConfig(service));
    return service;
  }

  private Object retrieveServiceConnectionConfig(T service) {
    return secretsManager.encryptOrDecryptServiceConnectionConfig(
        service.getConnection().getConfig(), extractServiceType(service), service.getName(), serviceType, false);
  }

  protected ResultList<T> decryptOrNullify(SecurityContext securityContext, ResultList<T> services) {
    listOrEmpty(services.getData()).forEach(service -> decryptOrNullify(securityContext, service));
    return services;
  }

  protected T nullifyRequiredConnectionParameters(T service) {
    Object connectionConfig = retrieveServiceConnectionConfig(service);
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

  protected abstract T nullifyConnection(T service);

  protected abstract String extractServiceType(T service);
}
