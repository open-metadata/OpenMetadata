package org.openmetadata.mcp.tools;

import static java.util.Map.entry;

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

  /** Knowledge Page fields maintained by relationships or background processing. */
  private static final Set<String> PAGE_SYSTEM_FIELDS =
      Set.of(
          "attachments",
          "children",
          "childrenCount",
          "dataProducts",
          "editors",
          "extractionStats",
          "followers",
          "memoryCount",
          "processingError",
          "processingStatus",
          "votes");

  private static final Map<String, String> DEDICATED_CREATE_FLOWS =
      Map.ofEntries(
          entry(
              Entity.USER,
              "user creation performs authentication, password, role, and invitation setup"),
          entry(
              Entity.BOT,
              "bot creation validates the bot user and applies impersonation safeguards"),
          entry(Entity.APPLICATION, "application creation installs and schedules the application"),
          entry(
              Entity.EVENT_SUBSCRIPTION,
              "event subscription creation validates destinations and registers its publisher"),
          entry(
              Entity.INGESTION_PIPELINE,
              "ingestion pipeline creation uses pipeline-specific permissions and secret handling"),
          entry(Entity.TEST_CASE, "test case creation authorizes against the tested asset"),
          entry(Entity.TEST_SUITE, "test suite creation authorizes against the tested table"),
          entry(
              Entity.WORKFLOW,
              "workflow creation requires connection-secret masking and unmasking"),
          entry(
              Entity.ANNOUNCEMENT,
              "announcement creation restricts system-wide announcements to administrators"),
          entry(Entity.INTAKE_FORM, "intake form creation is restricted to administrators"),
          entry(Entity.PERSONA, "persona creation is restricted to administrators"),
          entry(Entity.DOCUMENT, "document creation keeps private document types out of reach"),
          entry(
              Entity.AUDIT_REPORT,
              "audit report creation deduplicates the request and queues its generation"),
          entry(
              Entity.TASK,
              "task creation stamps the filer and authorizes against the task's target entity"));

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
        || (Tag.class.equals(entityClass) && "classification".equals(field));
  }

  boolean isMcpOwned(String field) {
    return (ContextMemory.class.equals(entityClass) && "sourceType".equals(field))
        || (Page.class.equals(entityClass) && PAGE_SYSTEM_FIELDS.contains(field));
  }

  boolean hasConditionalRequirements() {
    return Tag.class.equals(entityClass);
  }
}
