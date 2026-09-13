package org.openmetadata.service.entity.policy;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkDisabledTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.EntityMetadataWriter;
import org.openmetadata.service.entity.metadata.EntityReferenceValidator;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.metadata.EntityTagWriter;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil.PutResponse;

public interface EntityMetadataPolicy<T extends EntityInterface> extends EntityPolicyAccess<T> {

  /**
   * This method is called to store all the relationships of an entity. It is expected that all relationships are
   * already validated and completely setup before this method is called and no validation of relationships is required.
   *
   * @see TableRepository#storeRelationships(Table) for an example implementation
   */
  public void storeRelationships(T entity);

  /**
   * Helper method to batch delete relationships where entities are the "to" side.
   * Wraps the DAO method for convenience.
   */
  public default void deleteToMany(
      List<UUID> toIds, String toEntity, Relationship relationship, String fromEntity) {
    context()
        .services()
        .getRelationshipWriter()
        .deleteIncomingMany(
            new EntityRelationshipWriter.BatchSelection(toIds, toEntity, relationship, fromEntity));
  }

  /**
   * Helper method to batch delete relationships where entities are the "from" side.
   * Wraps the DAO method for convenience.
   */
  public default void deleteFromMany(
      List<UUID> fromIds, String fromEntity, Relationship relationship, String toEntity) {
    context()
        .services()
        .getRelationshipWriter()
        .deleteOutgoingMany(
            new EntityRelationshipWriter.BatchSelection(
                fromIds, fromEntity, relationship, toEntity));
  }

  /**
   * Batch version of clearEntitySpecificRelationships. Override in subclasses to clear
   * entity-specific relationships for multiple entities in batch.
   */
  public default void clearEntitySpecificRelationshipsForMany(List<T> entities) {
    // Default: no-op. Subclasses override if they have entity-specific relationships to clear.
  }

  public default void addServiceRelationship(T entity, EntityReference service) {
    if (service != null) {
      context()
          .policy()
          .relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  service.getId(),
                  entity.getId(),
                  service.getType(),
                  context().schema().entityType(),
                  Relationship.CONTAINS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  public default void storeEntitySpecificRelationshipsForMany(List<T> entities) {
    entities.forEach(context().policy()::storeRelationships);
  }

  public default void bulkInsertRelationships(
      List<CollectionDAO.EntityRelationshipObject> relationships) {
    context().services().getRelationshipWriter().insertMany(relationships);
  }

  public default CollectionDAO.EntityRelationshipObject newRelationship(
      UUID fromId, UUID toId, String fromEntity, String toEntity, Relationship relationship) {
    return EntityRelationshipWriter.row(fromId, toId, fromEntity, toEntity, relationship);
  }

  @Transaction
  public default void storeOwners(List<T> entities) {
    context().services().getMetadataWriter().storeMany(EntityMetadataWriter.Field.OWNERS, entities);
  }

  @Transaction
  public default void storeDomains(List<T> entities) {
    context()
        .services()
        .getMetadataWriter()
        .storeMany(EntityMetadataWriter.Field.DOMAINS, entities);
  }

  @Transaction
  public default void storeReviewers(List<T> entities) {
    context()
        .services()
        .getMetadataWriter()
        .storeMany(EntityMetadataWriter.Field.REVIEWERS, entities);
  }

  @Transaction
  public default void storeDataProducts(List<T> entities) {
    context()
        .services()
        .getMetadataWriter()
        .storeMany(EntityMetadataWriter.Field.DATA_PRODUCTS, entities);
  }

  @Transaction
  public default void applyTagsToEntities(List<T> entities) {
    if (context().supports(FIELD_TAGS)) {
      context().services().getTagWriter().addEntities(entities);
    }
  }

  @Transaction
  public default PutResponse<T> addFollower(String updatedBy, UUID entityId, UUID userId) {
    return context().services().getUserActions().follow(updatedBy, entityId, userId);
  }

  @Transaction
  public default PutResponse<T> updateVote(String updatedBy, UUID entityId, VoteRequest request) {
    return context().services().getUserActions().vote(updatedBy, entityId, request);
  }

  @Transaction
  public default PutResponse<T> deleteFollower(String updatedBy, UUID entityId, UUID userId) {
    return context().services().getUserActions().unfollow(updatedBy, entityId, userId);
  }

  public default void applyTags(T entity) {
    if (context().supports(FIELD_TAGS)) {
      context()
          .policy()
          .tagWrites()
          .add(
              entity.getTags(),
              new EntityTagWriter.Target(
                  entity.getFullyQualifiedName(), context().schema().entityType(), entity.getId()));
    }
  }

  public default List<EntityReference> getDomains(T entity) {
    return context().policy().getDomains(entity, NON_DELETED);
  }

  public default List<EntityReference> getDomains(T entity, Include include) {
    return context().services().getMetadataReads().fields().domains(entity, include);
  }

  public default List<EntityReference> getDataProducts(UUID entityId, String entityType) {
    return context().policy().getDataProducts(entityId, entityType, NON_DELETED);
  }

  public default List<EntityReference> getDataProducts(
      UUID entityId, String entityType, Include include) {
    return context()
        .policy()
        .relationships()
        .from(
            new EntityRelationshipReader.Selection(
                entityId, entityType, Relationship.HAS, DATA_PRODUCT),
            include);
  }

  public default List<EntityReference> getChildren(T entity) {
    return context().policy().getChildren(entity, NON_DELETED);
  }

  public default List<EntityReference> getChildren(T entity, Include include) {
    return context().services().getMetadataReads().fields().children(entity, include);
  }

  public default List<EntityReference> getValidatedDomains(List<EntityReference> domains) {
    return EntityReferenceValidator.shared()
        .validatedDomains(domains, context().supports(FIELD_DOMAINS));
  }

  @Transaction
  public default void storeOwners(T entity, List<EntityReference> owners) {
    context()
        .services()
        .getMetadataWriter()
        .store(EntityMetadataWriter.Field.OWNERS, entity, owners);
  }

  @Transaction
  public default void storeDomains(T entity, List<EntityReference> domains) {
    context()
        .services()
        .getMetadataWriter()
        .store(EntityMetadataWriter.Field.DOMAINS, entity, domains);
  }

  @Transaction
  public default void storeReviewers(T entity, List<EntityReference> reviewers) {
    context()
        .services()
        .getMetadataWriter()
        .store(EntityMetadataWriter.Field.REVIEWERS, entity, reviewers);
  }

  @Transaction
  public default void storeDataProducts(T entity, List<EntityReference> dataProducts) {
    context()
        .services()
        .getMetadataWriter()
        .store(EntityMetadataWriter.Field.DATA_PRODUCTS, entity, dataProducts);
  }

  @Transaction
  public default void updateOwners(
      T ownedEntity, List<EntityReference> originalOwners, List<EntityReference> newOwners) {
    context().services().getOwnershipWriter().owners(ownedEntity, originalOwners, newOwners);
  }

  public default String getCustomPropertyFQNPrefix(String entityType) {
    return FullyQualifiedName.build(entityType, "customProperties");
  }

  public default String getCustomPropertyFQN(String entityType, String propertyName) {
    return FullyQualifiedName.build(entityType, "customProperties", propertyName);
  }

  public default List<EntityReference> getIngestionPipelines(T service) {
    return context()
        .policy()
        .relationships()
        .to(
            new EntityRelationshipReader.Selection(
                service.getId(),
                context().schema().entityType(),
                Relationship.CONTAINS,
                Entity.INGESTION_PIPELINE),
            Include.NON_DELETED);
  }

  public default void validateTags(T entity) {
    if (!context().supports(FIELD_TAGS)) {
      return;
    }
    context().policy().validateTags(entity.getTags());
    entity.setTags(addDerivedTags(entity.getTags()));
    checkMutuallyExclusive(entity.getTags());
    checkDisabledTags(entity.getTags());
  }

  public default void validateTags(List<TagLabel> labels) {
    for (TagLabel label : listOrEmpty(labels)) {
      TagLabelUtil.applyTagCommonFields(label);
    }
  }

  public default List<EntityReference> validateDomains(List<String> domainFqns) {
    return EntityReferenceValidator.shared().domains(domainFqns, context().supports(FIELD_DOMAINS));
  }

  public default List<EntityReference> validateDomainsByRef(List<EntityReference> domains) {
    return EntityReferenceValidator.shared()
        .domainsByRef(domains, context().supports(FIELD_DOMAINS));
  }

  /**
   * Validates each data product and hydrates the supplied reference in place.
   *
   * <p>Lifecycle handlers receive these references before relationships are reloaded, so search
   * indexing requires a fully populated reference at this stage.
   */
  public default void validateDataProducts(List<EntityReference> dataProducts) {
    EntityReferenceValidator.shared()
        .dataProducts(dataProducts, context().supports(FIELD_DATA_PRODUCTS));
  }

  public default List<TagLabel> getAllTags(EntityInterface entity) {
    return entity.getTags();
  }

  public default void validateColumnTags(List<Column> columns) {
    // Add column level tags by adding tag to column relationship
    for (Column column : listOrEmpty(columns)) {
      context().policy().validateTags(column.getTags());
      column.setTags(addDerivedTags(column.getTags()));
      checkMutuallyExclusive(column.getTags());
      if (column.getChildren() != null) {
        context().policy().validateColumnTags(column.getChildren());
      }
    }
  }
}
