package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.MetadataCollectionConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.MetadataCollectionConfiguration.TaskAssignees;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.RequiredMetadataField;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.metadata.MetadataCollectionService;
import org.openmetadata.service.jdbi3.TaskRepository;

/** ADR:2026-10-15-a-lifecycle-stage-asks-for-its-missing-metadata-in-one-task */
@ExtendWith(TestNamespaceExtension.class)
class LifecycleMetadataTasksIT {
  private static final String DRAFT_NODE = "CollectDraft";
  private static final String WORKFLOWS = "/v1/governance/workflowDefinitions";
  private static final String READY = "{\"==\":[{\"var\":\"description\"},\"Ready\"]}";

  @Test
  void asksForEveryMissingFieldInOneTaskAndCompletesOnceTheyAreFilledIn(TestNamespace namespace) {
    final Domain domain = createDomain(namespace);
    final String workflow = createWorkflow(namespace);
    try {
      final MetadataCollectionConfiguration configuration = draftFields();
      service().reconcile(domain, configuration, workflow, DRAFT_NODE);
      service().reconcile(domain, configuration, workflow, DRAFT_NODE);
      final JsonNode task = onlyTask(domain);
      assertEquals("MetadataCompletion", task.get("type").asText());
      assertEquals("Open", task.get("status").asText());
      assertEquals(List.of("description", "experts"), missingFields(task));
      assertEquals("recheck", task.at("/availableTransitions/0/id").asText());

      final Domain described = updateDescription(domain, "Purpose");
      service().reconcile(described, configuration, workflow, DRAFT_NODE);
      assertEquals(task.get("id"), onlyTask(domain).get("id"));
      assertEquals(List.of("experts"), missingFields(onlyTask(domain)));

      service().reconcile(addExpert(described), configuration, workflow, DRAFT_NODE);
      assertEquals("Completed", onlyTask(domain).get("status").asText());
    } finally {
      cleanup(domain, workflow);
    }
  }

  @Test
  void closesWhenTheAssetLeavesTheStageAndReopensWithItsActionOnReturn(TestNamespace namespace) {
    final Domain domain = createDomain(namespace);
    final String workflow = createWorkflow(namespace);
    try {
      final MetadataCollectionConfiguration draft = draftFields();
      service().reconcile(domain, draft, workflow, DRAFT_NODE);
      final JsonNode original = onlyTask(domain);

      final Domain inReview = updateStage(domain, EntityStatus.IN_REVIEW);
      service().reconcile(inReview, inReviewFields(), workflow, "CollectInReview");
      assertEquals("Cancelled", onlyTask(domain).get("status").asText());

      service().reconcile(updateStage(domain, EntityStatus.DRAFT), draft, workflow, DRAFT_NODE);
      final JsonNode reopened = onlyTask(domain);
      assertEquals(original.get("id"), reopened.get("id"));
      assertEquals("Open", reopened.get("status").asText());
      assertEquals("recheck", reopened.at("/availableTransitions/0/id").asText());
    } finally {
      cleanup(domain, workflow);
    }
  }

  @Test
  void twoStepsOfOneStageEachAskTheirOwnAssigneesForTheirOwnFields(TestNamespace namespace) {
    final Domain domain = createDomain(namespace);
    final String workflow = createWorkflow(namespace);
    try {
      final MetadataCollectionConfiguration description =
          draftFields().withFields(List.of(draftFields().getFields().get(0)));
      final MetadataCollectionConfiguration experts =
          draftFields()
              .withFields(List.of(draftFields().getFields().get(1)))
              .withTaskAssignees(TaskAssignees.OWNERS);
      service().reconcile(domain, description, workflow, DRAFT_NODE);
      service().reconcile(domain, experts, workflow, DRAFT_NODE + "x1");

      final JsonNode tasks = tasks(domain);
      assertEquals(2, tasks.size());
      final Map<List<String>, List<String>> askedBy = new java.util.HashMap<>();
      tasks.forEach(task -> askedBy.put(missingFields(task), assigneeNames(task)));
      assertEquals(List.of(sharedUser().getName()), askedBy.get(List.of("description")));
      assertTrue(askedBy.get(List.of("experts")).contains("admin"));
    } finally {
      cleanup(domain, workflow);
    }
  }

  @Test
  void aStepWithNoFieldsClosesTheTaskOfTheStageTheAssetLeft(TestNamespace namespace) {
    final Domain domain = createDomain(namespace);
    final String workflow = createWorkflow(namespace);
    try {
      service().reconcile(domain, draftFields(), workflow, DRAFT_NODE);
      final MetadataCollectionConfiguration nothingToAsk = inReviewFields().withFields(List.of());

      service()
          .reconcile(
              updateStage(domain, EntityStatus.IN_REVIEW),
              nothingToAsk,
              workflow,
              "CollectInReview");

      assertEquals("Cancelled", onlyTask(domain).get("status").asText());
    } finally {
      cleanup(domain, workflow);
    }
  }

  @Test
  void asksTheAdminsUntilTheAssetHasOwnersAndThenAsksThem(TestNamespace namespace) {
    final Domain domain = createDomain(namespace);
    final String workflow = createWorkflow(namespace);
    try {
      final MetadataCollectionConfiguration owners =
          draftFields().withTaskAssignees(TaskAssignees.OWNERS);
      service().reconcile(domain, owners, workflow, DRAFT_NODE);
      assertTrue(assigneeNames(onlyTask(domain)).contains("admin"));

      service().reconcile(addOwner(domain), owners, workflow, DRAFT_NODE);
      assertEquals(List.of(sharedUser().getName()), assigneeNames(onlyTask(domain)));
    } finally {
      cleanup(domain, workflow);
    }
  }

  @Test
  void refusesClientEditsAndARecheckWhileFieldsAreMissing(TestNamespace namespace) {
    final Domain domain = createDomain(namespace);
    final String workflow = createWorkflow(namespace);
    try {
      service().reconcile(domain, draftFields(), workflow, DRAFT_NODE);
      final String taskId = onlyTask(domain).get("id").asText();

      final InvalidRequestException edited =
          assertThrows(InvalidRequestException.class, () -> editDescription(taskId));
      final InvalidRequestException rechecked =
          assertThrows(InvalidRequestException.class, () -> recheck(taskId));

      assertTrue(edited.getMessage().contains("opened and kept by lifecycle workflows"));
      assertTrue(rechecked.getMessage().contains("Still missing: Description, Experts"));
      assertEquals("Open", onlyTask(domain).get("status").asText());
    } finally {
      cleanup(domain, workflow);
    }
  }

  private static void editDescription(final String taskId) {
    SdkClients.adminClient()
        .tasks()
        .patch(
            UUID.fromString(taskId),
            JsonUtils.readTree(
                """
                [{"op":"replace","path":"/description","value":"Done"}]"""));
  }

  @Test
  void aRecheckCompletesTheTaskOnceTheFieldsAreFilledIn(TestNamespace namespace) {
    final Domain domain = createDomain(namespace);
    final String workflow = createWorkflow(namespace);
    try {
      service().reconcile(domain, draftFields(), workflow, DRAFT_NODE);
      final String taskId = onlyTask(domain).get("id").asText();
      addExpert(updateDescription(domain, "Purpose"));

      recheck(taskId);

      assertEquals("Completed", onlyTask(domain).get("status").asText());
    } finally {
      cleanup(domain, workflow);
    }
  }

  @Test
  void keepsTheTaskOpenWhileTheStageConditionsFailAndSaysSoGenerically(TestNamespace namespace) {
    final Domain domain = createDomain(namespace);
    final MetadataCollectionConfiguration conditionsOnly =
        draftFields().withFields(List.of()).withConditions(READY);
    final String workflow = createWorkflow(namespace, conditionsOnly);
    try {
      service().reconcile(domain, conditionsOnly, workflow, DRAFT_NODE);
      final JsonNode task = onlyTask(domain);
      assertEquals("Open", task.get("status").asText());
      assertEquals(List.of(), missingFields(task));
      assertFalse(task.at("/payload/conditionsMet").asBoolean());

      final String taskId = task.get("id").asText();
      final InvalidRequestException rechecked =
          assertThrows(InvalidRequestException.class, () -> recheck(taskId));
      assertTrue(rechecked.getMessage().contains("The lifecycle conditions are not met."));

      service().reconcile(updateDescription(domain, "Ready"), conditionsOnly, workflow, DRAFT_NODE);
      assertEquals("Completed", onlyTask(domain).get("status").asText());
    } finally {
      cleanup(domain, workflow);
    }
  }

  private static void recheck(String taskId) {
    SdkClients.adminClient()
        .tasks()
        .resolve(
            taskId,
            new ResolveTask()
                .withTransitionId("recheck")
                .withResolutionType(TaskResolutionType.Completed));
  }

  private static String createWorkflow(TestNamespace namespace) {
    return createWorkflow(namespace, draftFields());
  }

  /** A re-check reads what the stored workflow's collect node asks for now. */
  private static String createWorkflow(
      TestNamespace namespace, MetadataCollectionConfiguration configuration) {
    final String name = namespace.prefix("metadataTasksWorkflow");
    final Map<String, Object> collect =
        Map.of(
            "type",
            "automatedTask",
            "subType",
            "collectMetadataTask",
            "name",
            DRAFT_NODE,
            "config",
            configuration,
            "inputNamespaceMap",
            Map.of("relatedEntity", "global"));
    execute(
        HttpMethod.POST,
        WORKFLOWS,
        Map.of(
            "name", name,
            "description", "Metadata completion tasks",
            "trigger", Map.of("type", "noOp", "config", Map.of(), "output", List.of()),
            "nodes",
                List.of(
                    Map.of("type", "startEvent", "subType", "startEvent", "name", "start"),
                    collect,
                    Map.of("type", "endEvent", "subType", "endEvent", "name", "end")),
            "edges",
                List.of(
                    Map.of("from", "start", "to", DRAFT_NODE),
                    Map.of("from", DRAFT_NODE, "to", "end"))));
    return name;
  }

  private static MetadataCollectionConfiguration draftFields() {
    return new MetadataCollectionConfiguration()
        .withStage(EntityStatus.DRAFT)
        .withTargetStage(EntityStatus.IN_REVIEW)
        .withTaskAssignees(TaskAssignees.CANDIDATES)
        .withCandidates(List.of(sharedUser()))
        .withFields(
            List.of(
                new RequiredMetadataField()
                    .withField("description")
                    .withRules("{\"!!\":[{\"var\":\"description\"}]}"),
                new RequiredMetadataField()
                    .withField("experts")
                    .withRules(
                        "{\"some\":[{\"var\":\"experts\"},{\"!=\":[{\"var\":\"fullyQualifiedName\"},null]}]}")));
  }

  private static MetadataCollectionConfiguration inReviewFields() {
    return draftFields()
        .withStage(EntityStatus.IN_REVIEW)
        .withTargetStage(EntityStatus.APPROVED)
        .withFields(
            List.of(
                new RequiredMetadataField()
                    .withField("name")
                    .withRules("{\"!!\":[{\"var\":\"name\"}]}")));
  }

  private static EntityReference sharedUser() {
    return Entity.getEntityReferenceByName(Entity.USER, "shared_user1", Include.NON_DELETED);
  }

  private static MetadataCollectionService service() {
    return new MetadataCollectionService(
        (TaskRepository) Entity.getEntityRepository(Entity.TASK),
        Entity.getEntityReferenceByName(Entity.USER, "governance-bot", Include.NON_DELETED));
  }

  private static List<String> missingFields(JsonNode task) {
    return JsonUtils.convertValue(
        task.at("/payload/missingFields"), new TypeReference<List<String>>() {});
  }

  private static Domain createDomain(TestNamespace namespace) {
    final Domain domain =
        JsonUtils.convertValue(
            execute(
                HttpMethod.POST,
                "/v1/domains",
                Map.of(
                    "name",
                    namespace.prefix("metadataTasks"),
                    "description",
                    "",
                    "domainType",
                    "Aggregate")),
            Domain.class);
    return updateStage(domain, EntityStatus.DRAFT);
  }

  private static Domain updateDescription(Domain domain, String value) {
    return patch(domain, Map.of("op", "add", "path", "/description", "value", value));
  }

  private static Domain addExpert(Domain domain) {
    return patch(
        domain,
        Map.of(
            "op",
            "add",
            "path",
            "/experts",
            "value",
            List.of(Map.of("id", sharedUser().getId().toString(), "type", Entity.USER))));
  }

  private static Domain addOwner(Domain domain) {
    return patch(
        domain,
        Map.of(
            "op",
            "add",
            "path",
            "/owners",
            "value",
            List.of(Map.of("id", sharedUser().getId().toString(), "type", Entity.USER))));
  }

  private static List<String> assigneeNames(JsonNode task) {
    final List<String> names = new ArrayList<>();
    task.get("assignees").forEach(assignee -> names.add(assignee.get("name").asText()));
    return names;
  }

  private static Domain updateStage(Domain domain, EntityStatus stage) {
    return patch(domain, Map.of("op", "add", "path", "/entityStatus", "value", stage.value()));
  }

  private static Domain patch(Domain domain, Map<String, Object> operation) {
    return JsonUtils.convertValue(
        execute(HttpMethod.PATCH, "/v1/domains/" + domain.getId(), List.of(operation)),
        Domain.class);
  }

  private static JsonNode tasks(Domain domain) {
    return execute(
            HttpMethod.GET,
            "/v1/tasks?category=MetadataUpdate&fields=assignees,about,payload,availableTransitions"
                + "&aboutEntity="
                + domain.getFullyQualifiedName(),
            null)
        .get("data");
  }

  private static JsonNode onlyTask(Domain domain) {
    final JsonNode tasks = tasks(domain);
    assertEquals(1, tasks.size());
    return tasks.get(0);
  }

  private static void cleanup(Domain domain, String workflow) {
    tasks(domain)
        .forEach(
            task ->
                execute(
                    HttpMethod.DELETE,
                    "/v1/tasks/" + task.get("id").asText() + "?hardDelete=true&recursive=true",
                    null));
    execute(
        HttpMethod.DELETE,
        "/v1/domains/" + domain.getId() + "?hardDelete=true&recursive=true",
        null);
    execute(
        HttpMethod.DELETE,
        WORKFLOWS + "/name/" + workflow + "?hardDelete=true&recursive=true",
        null);
  }

  private static JsonNode execute(HttpMethod method, String path, Object body) {
    return JsonUtils.readTree(
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                method,
                path,
                method == HttpMethod.PATCH ? JsonUtils.convertValue(body, JsonNode.class) : body));
  }
}
