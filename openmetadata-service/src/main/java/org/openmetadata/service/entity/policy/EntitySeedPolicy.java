package org.openmetadata.service.entity.policy;

import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.entity.metadata.EntityReferenceValidator;
import org.openmetadata.service.resources.teams.RoleResource;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.seeding.SeedDataGate;

public interface EntitySeedPolicy<T extends EntityInterface> extends EntityPolicyAccess<T> {

  /**
   * Initialize data from json files if seed data does not exist in corresponding tables. Seed data is stored under
   * openmetadata-service/src/main/resources/json/data/{entityType}
   *
   * <p>This method needs to be explicitly called, typically from initialize method. See {@link
   * RoleResource#initialize(OpenMetadataApplicationConfig)}
   */
  public default void initSeedDataFromResourcesOnStartup() throws IOException {
    if (!SeedDataGate.getInstance().shouldSeed()) {
      return;
    }
    context().policy().initSeedDataFromResources();
  }

  public default void initSeedDataFromResources() throws IOException {
    context()
        .services()
        .getSeedInitializer()
        .initializeAll(context().policy().getEntitiesFromSeedData());
  }

  public default List<T> getEntitiesFromSeedData() throws IOException {
    return context()
        .policy()
        .getEntitiesFromSeedData(
            String.format(".*json/data/%s/.*\\.json$", context().schema().entityType()));
  }

  public default List<T> getEntitiesFromSeedData(String path) throws IOException {
    return EntityPolicySupport.getEntitiesFromSeedData(
        context().schema().entityType(), path, context().schema().entityClass());
  }

  /**
   * Initialize a given entity if it does not exist.
   */
  @Transaction
  public default void initializeEntity(T entity) {
    context().services().getSeedInitializer().initialize(entity);
  }

  public default T copy(T entity, CreateEntity request, String updatedBy) {
    List<EntityReference> owners = EntityReferenceValidator.shared().owners(request.getOwners());
    List<EntityReference> domains = context().policy().validateDomains(request.getDomains());
    EntityReferenceValidator.shared().reviewers(request.getReviewers());
    entity.setId(UUID.randomUUID());
    entity.setName(request.getName());
    entity.setDisplayName(request.getDisplayName());
    entity.setDescription(
        org.openmetadata.service.util.DescriptionSanitizer.sanitize(request.getDescription()));
    entity.setOwners(owners);
    entity.setDomains(domains);
    entity.setTags(request.getTags());
    entity.setDataProducts(getEntityReferences(DATA_PRODUCT, request.getDataProducts()));
    entity.setLifeCycle(request.getLifeCycle());
    entity.setExtension(request.getExtension());
    entity.setUpdatedBy(updatedBy);
    entity.setUpdatedAt(System.currentTimeMillis());
    entity.setReviewers(request.getReviewers());
    RuleEngine.getInstance().evaluate(entity);
    return entity;
  }
}
