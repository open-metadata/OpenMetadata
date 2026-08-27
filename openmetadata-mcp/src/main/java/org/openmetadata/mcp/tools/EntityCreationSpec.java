package org.openmetadata.mcp.tools;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;

/** The repository-owned information needed to create one entity type. */
record EntityCreationSpec(
    String entityType,
    EntityRepository<? extends EntityInterface> repository,
    Class<? extends EntityInterface> entityClass) {

  /**
   * Knowledge page fields no create request carries: children and editors come from relationships,
   * votes and the extraction fields from background work. Offering {@code children} was actively
   * harmful - {@code storeRelationships} reads {@code child.getId()}, and a caller has no id.
   */
  private static final Set<String> PAGE_SYSTEM_FIELDS =
      Set.of(
          "children",
          "childrenCount",
          "editors",
          "followers",
          "votes",
          "attachments",
          "dataProducts",
          "processingStatus",
          "processingError",
          "extractionStats",
          "memoryCount");

  private static final Map<String, String> DEDICATED_CREATE_FLOWS =
      Map.of(
          Entity.USER,
          "user creation performs authentication, password, role, and invitation setup",
          Entity.BOT,
          "bot creation validates the bot user and applies impersonation safeguards",
          Entity.APPLICATION,
          "application creation installs and schedules the application",
          Entity.EVENT_SUBSCRIPTION,
          "event subscription creation validates destinations and registers its publisher",
          Entity.INGESTION_PIPELINE,
          "ingestion pipeline creation uses pipeline-specific permissions and secret handling",
          Entity.TEST_CASE,
          "test case creation authorizes against the tested asset",
          Entity.WORKFLOW,
          "workflow creation requires connection-secret masking and unmasking");

  static EntityCreationSpec resolve(String entityType) {
    rejectDedicatedCreateFlow(entityType, DEDICATED_CREATE_FLOWS.get(entityType));
    EntityRepository<? extends EntityInterface> repository;
    try {
      repository = Entity.getEntityRepository(entityType);
    } catch (EntityNotFoundException e) {
      String registeredTypes =
          Entity.getEntityList().stream().sorted().collect(Collectors.joining(", "));
      throw new IllegalArgumentException(
          "Unknown entityType '"
              + entityType
              + "'. Registered entity types: "
              + registeredTypes
              + ". Call describe_entity_type with the corrected type before creating it.",
          e);
    }
    Class<? extends EntityInterface> entityClass = repository.getEntityClass();
    if (ServiceEntityInterface.class.isAssignableFrom(entityClass)) {
      rejectDedicatedCreateFlow(
          entityType, "service creation requires connection-secret masking and unmasking");
    }
    return new EntityCreationSpec(entityType, repository, entityClass);
  }

  private static void rejectDedicatedCreateFlow(String entityType, String reason) {
    if (reason != null) {
      String alternative =
          Entity.TEST_CASE.equals(entityType)
              ? " Use create_test_case instead."
              : " Use the dedicated OpenMetadata API instead.";
      throw new IllegalArgumentException(
          "entityType '"
              + entityType
              + "' cannot be created through create_entity because "
              + reason
              + "."
              + alternative);
    }
  }

  @SuppressWarnings("unchecked")
  EntityRepository<EntityInterface> typedRepository() {
    return (EntityRepository<EntityInterface>) repository;
  }

  boolean hasMcpDefault(String field) {
    return (Domain.class.equals(entityClass) && "domainType".equals(field))
        || (Tag.class.equals(entityClass) && "classification".equals(field))
        || (Page.class.equals(entityClass) && "page".equals(field));
  }

  boolean isMcpOwned(String field) {
    return (ContextMemory.class.equals(entityClass) && "sourceType".equals(field))
        || (Page.class.equals(entityClass) && PAGE_SYSTEM_FIELDS.contains(field));
  }

  /** Requirements that hold only for some values of another field, in the caller's own terms. */
  List<String> conditionalRequirements() {
    List<String> requirements = List.of();
    if (Tag.class.equals(entityClass)) {
      requirements = List.of("classification is required unless parent identifies a parent tag");
    } else if (Page.class.equals(entityClass)) {
      requirements =
          List.of(
              "page is required when pageType is QuickLink and must carry its url; an Article"
                  + " page body defaults to an empty article and its markdown goes in description");
    }
    return requirements;
  }
}
