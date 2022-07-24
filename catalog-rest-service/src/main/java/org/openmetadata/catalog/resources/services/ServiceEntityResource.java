package org.openmetadata.catalog.resources.services;

import java.util.Collections;
import java.util.Optional;
import javax.ws.rs.core.SecurityContext;
import org.openmetadata.catalog.ServiceConnectionEntityInterface;
import org.openmetadata.catalog.ServiceEntityInterface;
import org.openmetadata.catalog.jdbi3.ServiceRepository;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.security.AuthorizationException;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.util.ResultList;

public abstract class ServiceEntityResource<
        T extends ServiceEntityInterface, R extends ServiceRepository<T, S>, S extends ServiceConnectionEntityInterface>
    extends EntityResource<T, R> {

  private final SecretsManager secretsManager;

  protected ServiceEntityResource(
      Class<T> entityClass, R serviceRepository, Authorizer authorizer, SecretsManager secretsManager) {
    super(entityClass, serviceRepository, authorizer);
    this.secretsManager = secretsManager;
  }

  protected T decryptOrNullify(SecurityContext securityContext, T service) {
    try {
      authorizer.authorizeAdmin(securityContext, secretsManager.isLocal());
    } catch (AuthorizationException e) {
      return nullifyConnection(service);
    }
    secretsManager.encryptOrDecryptServiceConnection(
        service.getConnection(), extractServiceType(service), service.getName(), false);
    return service;
  }

  protected ResultList<T> decryptOrNullify(SecurityContext securityContext, ResultList<T> services) {
    Optional.ofNullable(services.getData())
        .orElse(Collections.emptyList())
        .forEach(mlModelService -> decryptOrNullify(securityContext, mlModelService));
    return services;
  }

  protected abstract T nullifyConnection(T service);

  protected abstract String extractServiceType(T service);
}
