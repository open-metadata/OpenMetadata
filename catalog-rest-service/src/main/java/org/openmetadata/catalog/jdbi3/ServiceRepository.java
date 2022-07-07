package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.util.EntityUtil.objectMatch;

import java.io.IOException;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.ServiceConnectionEntityInterface;
import org.openmetadata.catalog.ServiceEntityInterface;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;

public abstract class ServiceRepository<T extends ServiceEntityInterface, S extends ServiceConnectionEntityInterface>
    extends EntityRepository<T> {
  private static final String UPDATE_FIELDS = "owner";

  private final Class<S> serviceConnectionClass;

  protected final SecretsManager secretsManager;

  public ServiceRepository(
      String collectionPath,
      String service,
      CollectionDAO dao,
      EntityDAO<T> entityDAO,
      SecretsManager secretsManager,
      Class<S> serviceConnectionClass) {
    super(collectionPath, service, entityDAO.getEntityClass(), entityDAO, dao, "", UPDATE_FIELDS);
    this.allowEdits = true;
    this.secretsManager = secretsManager;
    this.serviceConnectionClass = serviceConnectionClass;
  }

  public ServiceRepository(
      String collectionPath,
      String service,
      CollectionDAO dao,
      EntityDAO<T> entityDAO,
      SecretsManager secretsManager,
      Class<S> serviceConnectionClass,
      String updatedFields) {
    super(collectionPath, service, entityDAO.getEntityClass(), entityDAO, dao, "", updatedFields);
    this.allowEdits = true;
    this.secretsManager = secretsManager;
    this.serviceConnectionClass = serviceConnectionClass;
  }

  @Override
  public T setFields(T entity, EntityUtil.Fields fields) throws IOException {
    entity.setPipelines(fields.contains("pipelines") ? getIngestionPipelines(entity) : null);
    entity.setOwner(fields.contains(FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  @Override
  public void prepare(T service) throws IOException {
    setFullyQualifiedName(service);
    // Check if owner is valid and set the relationship
    service.setOwner(Entity.getEntityReference(service.getOwner()));
    // encrypt service connection
    secretsManager.encryptOrDecryptServiceConnection(
        service.getConnection(), getServiceType(service), service.getName(), true);
  }

  protected abstract String getServiceType(T service);

  @Override
  public void storeEntity(T service, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = service.getOwner();

    // Don't store owner, service, href and tags as JSON. Build it on the fly based on relationships
    service.withOwner(null).withHref(null);

    store(service.getId(), service, update);

    // Restore the relationships
    service.withOwner(owner);
  }

  @Override
  public void storeRelationships(T service) {
    // Add owner relationship
    storeOwner(service, service.getOwner());
  }

  @Override
  public ServiceUpdater getUpdater(T original, T updated, Operation operation) {
    return new ServiceUpdater(original, updated, operation);
  }

  public class ServiceUpdater extends EntityUpdater {

    public ServiceUpdater(T original, T updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateConnection();
    }

    private void updateConnection() throws IOException {
      if (secretsManager.isLocal()) {
        ServiceConnectionEntityInterface origConn = original.getConnection();
        ServiceConnectionEntityInterface updatedConn = updated.getConnection();
        String origJson = JsonUtils.pojoToJson(origConn);
        String updatedJson = JsonUtils.pojoToJson(updatedConn);
        S decryptedOrigConn = JsonUtils.readValue(origJson, serviceConnectionClass);
        S decryptedUpdatedConn = JsonUtils.readValue(updatedJson, serviceConnectionClass);
        secretsManager.encryptOrDecryptServiceConnection(
            decryptedOrigConn, getServiceType(original), original.getName(), false);
        secretsManager.encryptOrDecryptServiceConnection(
            decryptedUpdatedConn, getServiceType(updated), updated.getName(), false);
        if (!objectMatch.test(decryptedOrigConn, decryptedUpdatedConn)) {
          recordChange("connection", origConn, updatedConn, true);
        }
      }
    }
  }
}
