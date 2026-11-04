package org.openmetadata.service.governance.workflows.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.MetadataCollectionConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.RequiredMetadataField;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.MetadataCompletionPayload;
import org.openmetadata.schema.type.MetadataCompletionRevision;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.governance.workflows.metadata.MetadataCollectionService.Outstanding;
import org.openmetadata.service.jdbi3.TaskRepository;

class MetadataCollectionServiceTest {
  @ParameterizedTest
  @CsvSource({
    "experts, Experts",
    "description, Description",
    "extension.costCenter, Cost center",
    "metricExpression.code, Metric expression code"
  })
  void namesAFieldAsPeopleReadIt(final String path, final String name) {
    assertEquals(name, MetadataCollectionService.fieldName(path));
  }

  @Test
  void keepsOneTaskPerAssetAndStageNode() {
    final UUID asset = UUID.randomUUID();

    assertEquals(
        MetadataCollectionService.taskId(asset, "DomainLifecycle", "Collect0"),
        MetadataCollectionService.taskId(asset, "DomainLifecycle", "Collect0"));
    assertNotEquals(
        MetadataCollectionService.taskId(asset, "DomainLifecycle", "Collect0"),
        MetadataCollectionService.taskId(asset, "DomainLifecycle", "Collect1"));
  }

  @Test
  void keepsOneRevisionTaskPerAssetWorkflowAndStage() {
    final UUID asset = UUID.randomUUID();
    final UUID draft =
        MetadataCollectionService.revisionTaskId(asset, "DomainLifecycle", EntityStatus.DRAFT);

    assertEquals(
        draft,
        MetadataCollectionService.revisionTaskId(asset, "DomainLifecycle", EntityStatus.DRAFT));
    assertNotEquals(
        draft,
        MetadataCollectionService.revisionTaskId(asset, "DomainLifecycle", EntityStatus.IN_REVIEW));
    assertNotEquals(draft, MetadataCollectionService.taskId(asset, "DomainLifecycle", "Collect0"));
  }

  @Test
  void movingTheAssetClosesOnlyRevisionTasksOfTheStageItLeft() {
    final TaskRepository repository = mock(TaskRepository.class);
    final EntityReference bot = new EntityReference().withName("governance-bot").withType("user");
    final Domain domain =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("finance")
            .withFullyQualifiedName("finance");
    final Task leftBehind = completionTask(EntityStatus.IN_REVIEW, true);
    final Task currentStage = completionTask(EntityStatus.APPROVED, true);
    final Task collection = completionTask(EntityStatus.IN_REVIEW, false);
    when(repository.listOpenTasksByEntityAndType(eq("finance"), any(), anyInt()))
        .thenReturn(List.of(leftBehind, currentStage, collection));

    new MetadataCollectionService(repository, bot)
        .closeRevisionsOutside(domain, EntityStatus.APPROVED.value());

    final ArgumentCaptor<TaskResolution> resolution = ArgumentCaptor.forClass(TaskResolution.class);
    verify(repository).resolveTask(eq(leftBehind), resolution.capture(), eq("governance-bot"));
    verify(repository, never()).resolveTask(eq(currentStage), any(), any());
    verify(repository, never()).resolveTask(eq(collection), any(), any());
    assertEquals(TaskResolutionType.Cancelled, resolution.getValue().getType());
  }

  @Test
  void aRevisionTaskIsNotResolvedThroughTheApi() {
    final Task revision = completionTask(EntityStatus.IN_REVIEW, true);

    final BadRequestException refused =
        assertThrows(
            BadRequestException.class, () -> MetadataCollectionService.requireFilledIn(revision));

    assertEquals(MetadataCollectionService.REVISION_CLOSES_ON_EDIT, refused.getMessage());
  }

  private static Task completionTask(final EntityStatus stage, final boolean revision) {
    final MetadataCompletionPayload payload =
        new MetadataCompletionPayload().withStage(stage).withMissingFields(List.of());
    if (revision) {
      payload.setRevision(new MetadataCompletionRevision().withRequestedBy("karan"));
    }
    return new Task().withId(UUID.randomUUID()).withPayload(payload);
  }

  @Test
  void namesMissingFieldsButReportsUnmetConditionsOnlyGenerically() {
    assertEquals(
        "Still missing: Experts. The task completes itself once these are filled in."
            + " The lifecycle conditions are not met.",
        new Outstanding(List.of("experts"), false).describe());
    assertEquals(
        "The lifecycle conditions are not met.", new Outstanding(List.of(), false).describe());
    assertTrue(Outstanding.NOTHING.isNothing());
    assertFalse(new Outstanding(List.of(), false).isNothing());
  }

  @Test
  void checksTheStageConditionsAlongsideItsRequiredFields() {
    final Domain domain =
        new Domain().withId(UUID.randomUUID()).withName("finance").withDescription("Money");
    final MetadataCollectionConfiguration required =
        new MetadataCollectionConfiguration()
            .withStage(EntityStatus.DRAFT)
            .withFields(
                List.of(
                    new RequiredMetadataField()
                        .withField("description")
                        .withRules("{\"!!\":[{\"var\":\"description\"}]}")));

    assertEquals(Outstanding.NOTHING, MetadataCollectionService.outstanding(domain, required));
    assertEquals(
        new Outstanding(List.of(), false),
        MetadataCollectionService.outstanding(
            domain, required.withConditions("{\"==\":[{\"var\":\"name\"},\"sales\"]}")));
    assertEquals(
        new Outstanding(List.of("description"), true),
        MetadataCollectionService.outstanding(
            domain.withDescription(null),
            required.withConditions("{\"==\":[{\"var\":\"name\"},\"finance\"]}")));
  }

  @Test
  void asksTheAdminsOnlyWhenTheAskedGroupIsEmpty() {
    final EntityReference admin = new EntityReference().withId(UUID.randomUUID()).withType("user");
    final EntityReference owner = new EntityReference().withId(UUID.randomUUID()).withType("user");

    assertEquals(
        List.of(admin), MetadataCollectionService.orAdmins(List.of(), () -> List.of(admin)));
    assertEquals(
        List.of(owner),
        MetadataCollectionService.orAdmins(
            List.of(owner),
            () -> {
              throw new AssertionError("the admins are not looked up while someone can be asked");
            }));
  }

  @Test
  void aRefreshedTaskKeepsItsAssigneesWhileTheAskedGroupIsEmpty() {
    final EntityReference admin = new EntityReference().withId(UUID.randomUUID()).withType("user");
    final EntityReference owner = new EntityReference().withId(UUID.randomUUID()).withType("user");
    final EntityReference steward =
        new EntityReference().withId(UUID.randomUUID()).withType("user");

    assertEquals(
        List.of(steward),
        MetadataCollectionService.refreshedAssignees(
            List.of(),
            List.of(steward),
            () -> {
              throw new AssertionError("the admins are not asked while the task has someone");
            }));
    assertEquals(
        List.of(admin),
        MetadataCollectionService.refreshedAssignees(List.of(), null, () -> List.of(admin)));
    assertEquals(
        List.of(owner),
        MetadataCollectionService.refreshedAssignees(
            List.of(owner), List.of(steward), () -> List.of(admin)));
  }
}
