package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.MetadataCollectionConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.MetadataCollectionConfiguration.TaskAssignees;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.metadata.MetadataCollectionService;
import org.openmetadata.service.jdbi3.TaskRepository;

@ExtendWith(TestNamespaceExtension.class)
class LifecycleMetadataTasksIT {
  @Test
  void cancelsAnOpenTaskAfterLeavingItsStageAndReopensItOnReturn(TestNamespace namespace) {
    final Domain domain = createDomain(namespace);
    try {
      final var configuration =
          configuration()
              .withTaskAssignees(TaskAssignees.CANDIDATES)
              .withCandidates(
                  List.of(
                      Entity.getEntityReferenceByName(
                          Entity.USER, "shared_user1", Include.NON_DELETED)));
      final var service = service();
      final String key = "stage-change:Draft";
      service.reconcile(domain, configuration, key);
      final JsonNode original = onlyTask(domain);
      assertEquals("Open", original.get("status").asText());

      final Domain advanced = updateStage(domain, EntityStatus.IN_REVIEW);
      service.reconcile(advanced, configuration, key);
      service.reconcile(advanced, configuration, key);
      final JsonNode cancelled = onlyTask(domain);
      assertEquals(original.get("id"), cancelled.get("id"));
      assertEquals("Cancelled", cancelled.get("status").asText());

      service.reconcile(updateStage(domain, EntityStatus.DRAFT), configuration, key);
      final JsonNode reopened = onlyTask(domain);
      assertEquals(original.get("id"), reopened.get("id"));
      assertEquals("Open", reopened.get("status").asText());
    } finally {
      cleanup(domain);
    }
  }

  @Test
  void reusesCompletesAndReopensARealMetadataTask(TestNamespace namespace) {
    final Domain domain = createDomain(namespace);
    try {
      final var configuration =
          configuration()
              .withTaskAssignees(TaskAssignees.CANDIDATES)
              .withCandidates(
                  List.of(
                      Entity.getEntityReferenceByName(
                          Entity.USER, "shared_user1", Include.NON_DELETED)));
      final var service = service();
      service.reconcile(domain, configuration, "metadata-test:Draft");
      service.reconcile(domain, configuration, "metadata-test:Draft");
      final JsonNode task = onlyTask(domain);
      assertEquals("Open", task.get("status").asText());
      assertTrue(task.get("description").asText().contains("Document the business purpose"));
      service.reconcile(updateDescription(domain, "Purpose"), configuration, "metadata-test:Draft");
      assertEquals("Completed", onlyTask(domain).get("status").asText());
      service.reconcile(updateDescription(domain, ""), configuration, "metadata-test:Draft");
      assertEquals(task.get("id"), onlyTask(domain).get("id"));
      assertEquals("Open", onlyTask(domain).get("status").asText());
    } finally {
      cleanup(domain);
    }
  }

  @Test
  void waitsForAssigneesAndSkipsConditionsThatDoNotApply(TestNamespace namespace) {
    final Domain domain = createDomain(namespace);
    try {
      final var configuration = configuration().withTaskAssignees(TaskAssignees.OWNERS);
      service().reconcile(domain, configuration, "missing-owners:Draft");
      assertEquals(0, tasks(domain).size());
      configuration
          .withTaskAssignees(TaskAssignees.CANDIDATES)
          .withCandidates(
              List.of(
                  Entity.getEntityReferenceByName(
                      Entity.USER, "shared_user1", Include.NON_DELETED)))
          .withAppliesWhen("{\"==\":[1,2]}");
      service().reconcile(domain, configuration, "conditional:Draft");
      assertEquals(0, tasks(domain).size());
      configuration.withAppliesWhen("{\"==\":[1,1]}");
      service()
          .reconcile(
              domain.withEntityStatus(EntityStatus.IN_REVIEW), configuration, "future:Draft");
      assertEquals(0, tasks(domain).size());
    } finally {
      cleanup(domain);
    }
  }

  private static MetadataCollectionConfiguration configuration() {
    return new MetadataCollectionConfiguration()
        .withField("description")
        .withStage(EntityStatus.DRAFT)
        .withRules("{\"!!\":[{\"var\":\"description\"}]}")
        .withGuidance("Document the business purpose")
        .withExample("Daily sales");
  }

  private static MetadataCollectionService service() {
    return new MetadataCollectionService(
        (TaskRepository) Entity.getEntityRepository(Entity.TASK),
        WorkflowHandler.getInstance(),
        Entity.getEntityReferenceByName(Entity.USER, "governance-bot", Include.NON_DELETED));
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
    return JsonUtils.convertValue(
        execute(
            HttpMethod.PATCH,
            "/v1/domains/" + domain.getId(),
            List.of(Map.of("op", "add", "path", "/entityStatus", "value", "Draft"))),
        Domain.class);
  }

  private static Domain updateDescription(Domain domain, String value) {
    return JsonUtils.convertValue(
        execute(
            HttpMethod.PATCH,
            "/v1/domains/" + domain.getId(),
            List.of(Map.of("op", "add", "path", "/description", "value", value))),
        Domain.class);
  }

  private static Domain updateStage(Domain domain, EntityStatus stage) {
    return JsonUtils.convertValue(
        execute(
            HttpMethod.PATCH,
            "/v1/domains/" + domain.getId(),
            List.of(Map.of("op", "add", "path", "/entityStatus", "value", stage.value()))),
        Domain.class);
  }

  private static JsonNode tasks(Domain domain) {
    return execute(
            HttpMethod.GET,
            "/v1/tasks?category=MetadataUpdate&fields=assignees,about&aboutEntity="
                + domain.getFullyQualifiedName(),
            null)
        .get("data");
  }

  private static JsonNode onlyTask(Domain domain) {
    final JsonNode tasks = tasks(domain);
    assertEquals(1, tasks.size());
    return tasks.get(0);
  }

  private static void cleanup(Domain domain) {
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
