package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SearchDocs;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.DescriptionUpdatePayload;
import org.openmetadata.schema.type.DomainUpdatePayload;
import org.openmetadata.schema.type.OwnershipUpdatePayload;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TierUpdatePayload;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Approving a Description, Ownership, Tier or Domain update task applies the change to the entity
 * the task is about, for every entity type the task UI offers it on. {@link TaskResourceIT} covers
 * the same four for tables, with rejection and change-description detail.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class TaskEntityTypeResolutionIT {

  private static final String TIER = "Tier.Tier1";

  /** An entity type, how to create one, and which update tasks apply to it. */
  private record TaskTarget(
      String entityType, Supplier<BaseEntityIT<?, ?>> entityIt, Set<TaskEntityType> taskTypes) {
    @Override
    public String toString() {
      return entityType;
    }
  }

  private static final Set<TaskEntityType> ALL =
      Set.of(
          TaskEntityType.DescriptionUpdate,
          TaskEntityType.OwnershipUpdate,
          TaskEntityType.TierUpdate,
          TaskEntityType.DomainUpdate);
  private static final Set<TaskEntityType> NO_TIER =
      Set.of(
          TaskEntityType.DescriptionUpdate,
          TaskEntityType.OwnershipUpdate,
          TaskEntityType.DomainUpdate);

  static Stream<Arguments> targets() {
    return Stream.of(
            new TaskTarget("table", TableResourceIT::new, ALL),
            new TaskTarget("topic", TopicResourceIT::new, ALL),
            new TaskTarget("dashboard", DashboardResourceIT::new, ALL),
            new TaskTarget("pipeline", PipelineResourceIT::new, ALL),
            new TaskTarget("container", ContainerResourceIT::new, ALL),
            new TaskTarget("mlmodel", MlModelResourceIT::new, ALL),
            new TaskTarget("searchIndex", SearchIndexResourceIT::new, ALL),
            new TaskTarget("metric", MetricResourceIT::new, ALL),
            new TaskTarget("glossary", GlossaryResourceIT::new, NO_TIER),
            new TaskTarget("glossaryTerm", GlossaryTermResourceIT::new, NO_TIER),
            new TaskTarget("directory", DirectoryResourceIT::new, NO_TIER),
            new TaskTarget("file", FileResourceIT::new, NO_TIER),
            new TaskTarget(
                "dataProduct",
                DataProductResourceIT::new,
                Set.of(TaskEntityType.DescriptionUpdate, TaskEntityType.OwnershipUpdate)))
        .map(Arguments::of);
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("targets")
  void approvedMetadataTaskAppliesToEntity(final TaskTarget target, final TestNamespace ns) {
    final BaseEntityIT<?, ?> entityIt = target.entityIt().get();
    final EntityInterface<?> entity = create(entityIt, ns);
    final String about =
        TaskResourceIT.entityLink(target.entityType(), entity.getFullyQualifiedName());
    final String description = "Approved description " + ns.uniqueShortId();

    for (final TaskEntityType type : target.taskTypes()) {
      approve(ns, about, type, payloadFor(type, entity, description), description);
    }

    final JsonNode updated = read(entityIt, entity);
    for (final TaskEntityType type : target.taskTypes()) {
      assertApplied(type, updated, description);
    }
  }

  private static <T extends EntityInterface<?>, K> T create(
      final BaseEntityIT<T, K> entityIt, final TestNamespace ns) {
    return entityIt.createEntity(entityIt.createMinimalRequest(ns));
  }

  /** The approved change of {@code type} is visible on the re-read entity. */
  private static void assertApplied(
      final TaskEntityType type, final JsonNode updated, final String description) {
    switch (type) {
      case DescriptionUpdate -> assertEquals(description, updated.path("description").asText());
      case OwnershipUpdate -> assertOwnedBySharedUser2(updated);
      case TierUpdate -> assertTrue(
          SearchDocs.tagFqns(updated).contains(TIER), "tags: " + updated.path("tags"));
      case DomainUpdate -> assertInSharedDomain(updated);
      default -> throw new IllegalArgumentException("No assertion for " + type);
    }
  }

  private static void assertOwnedBySharedUser2(final JsonNode updated) {
    assertEquals(
        Set.of(SharedEntities.get().USER2.getName()),
        SearchDocs.fieldValues(updated.path("owners"), "name"));
  }

  private static void assertInSharedDomain(final JsonNode updated) {
    assertTrue(
        SearchDocs.fieldValues(updated.path("domains"), "fullyQualifiedName")
            .contains(SharedEntities.get().DOMAIN.getFullyQualifiedName()),
        "domains: " + updated.path("domains"));
  }

  private static Object payloadFor(
      final TaskEntityType type, final EntityInterface<?> entity, final String description) {
    final SharedEntities shared = SharedEntities.get();
    return switch (type) {
      case DescriptionUpdate -> new DescriptionUpdatePayload()
          .withFieldPath("description")
          .withCurrentDescription(entity.getDescription())
          .withNewDescription(description);
      case OwnershipUpdate -> new OwnershipUpdatePayload()
          .withCurrentOwners(entity.getOwners())
          .withNewOwners(List.of(shared.USER2_REF));
      case TierUpdate -> new TierUpdatePayload().withNewTier(tierLabel());
      case DomainUpdate -> new DomainUpdatePayload()
          .withNewDomain(shared.DOMAIN.getEntityReference());
      default -> throw new IllegalArgumentException("No payload for " + type);
    };
  }

  private static TagLabel tierLabel() {
    return new TagLabel()
        .withTagFQN(TIER)
        .withName("Tier1")
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static void approve(
      final TestNamespace ns,
      final String about,
      final TaskEntityType type,
      final Object payload,
      final String description) {
    final Task task = createTask(ns, about, type, payload);
    TaskResourceIT.awaitTaskReadyForWorkflowResolution(task.getId());
    final ResolveTask resolve = new ResolveTask().withResolutionType(TaskResolutionType.Approved);
    if (type == TaskEntityType.DescriptionUpdate) {
      resolve.withNewValue(description);
    }
    final Task resolved =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolve);
    assertEquals(TaskEntityStatus.Approved, resolved.getStatus(), type + " on " + about);
  }

  private static Task createTask(
      final TestNamespace ns, final String about, final TaskEntityType type, final Object payload) {
    return SdkClients.adminClient()
        .tasks()
        .create(
            new CreateTask()
                .withName(ns.prefix(type.value() + ns.uniqueShortId()))
                .withDescription(type.value() + " task")
                .withCategory(TaskCategory.MetadataUpdate)
                .withType(type)
                .withAbout(about)
                .withPayload(payload));
  }

  private static <T extends EntityInterface<?>> JsonNode read(
      final BaseEntityIT<T, ?> entityIt, final EntityInterface<?> entity) {
    return JsonUtils.valueToTree(
        entityIt.getEntityWithFields(entity.getId().toString(), "owners,tags,domains"));
  }
}
