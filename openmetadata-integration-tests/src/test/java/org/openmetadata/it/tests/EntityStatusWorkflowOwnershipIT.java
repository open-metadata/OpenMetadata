package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.ApiAssertions.assertForbidden;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashMap;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.governance.EntityLifecycleStages;
import org.openmetadata.schema.api.governance.EntityTypeLifecycle;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.teams.TeamService;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.service.Entity;

/**
 * An active governance workflow owns the lifecycle stage of the entities it applies to, so their
 * stage changes only through the workflow. Isolated because the workflow each test deploys applies
 * to every entity of its type that passes the workflow's filter.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class EntityStatusWorkflowOwnershipIT {
  private static final String WORKFLOWS_PATH = "/v1/governance/workflowDefinitions";
  private static final String LIFECYCLE_STAGES_PATH = "/v1/metadata/types/lifecycleStages";
  private static final String PAGES_PATH = "v1/contextCenter/pages";
  private static final String OWNED_MARKER = "stageowned";

  @Test
  void workflowOwnsTheStageOfTheEntitiesItAppliesTo(TestNamespace ns) {
    JsonNode workflow = createStageWorkflow(ns, Entity.DOMAIN);
    try {
      Domain owned = createDomain(ns.prefix(OWNED_MARKER));
      Domain unowned = createDomain(ns.prefix("unowned"));

      assertTrue(stageWorkflows(Entity.DOMAIN).contains(name(workflow)));
      OpenMetadataException rejected =
          assertForbidden(
              () -> moveToStage(owned, EntityStatus.APPROVED),
              "The workflow owns the stage of the domains it applies to");
      assertTrue(rejected.getMessage().contains(name(workflow)), rejected.getMessage());
      assertEquals(EntityStatus.DRAFT, domain(owned).getEntityStatus());
      assertEquals(
          EntityStatus.APPROVED, moveToStage(unowned, EntityStatus.APPROVED).getEntityStatus());
    } finally {
      deleteWorkflow(workflow);
    }
  }

  @Test
  void suspendingTheWorkflowReleasesTheStage(TestNamespace ns) {
    JsonNode workflow = createStageWorkflow(ns, Entity.DOMAIN);
    try {
      Domain owned = createDomain(ns.prefix(OWNED_MARKER));

      changeWorkflowState(workflow, "suspend");
      assertFalse(stageWorkflows(Entity.DOMAIN).contains(name(workflow)));
      assertEquals(
          EntityStatus.APPROVED, moveToStage(owned, EntityStatus.APPROVED).getEntityStatus());

      changeWorkflowState(workflow, "resume");
      assertTrue(stageWorkflows(Entity.DOMAIN).contains(name(workflow)));
      assertForbidden(
          () -> moveToStage(owned, EntityStatus.DEPRECATED),
          "A resumed workflow owns the stage again");
    } finally {
      deleteWorkflow(workflow);
    }
  }

  @Test
  void entityCreatedInAStageTheWorkflowOwnsStartsInItsTypesInitialStage(TestNamespace ns)
      throws Exception {
    JsonNode workflow = createStageWorkflow(ns, Entity.PAGE);
    try {
      Page owned = createArticle(ns.prefix(OWNED_MARKER), EntityStatus.APPROVED);
      Page unowned = createArticle(ns.prefix("unowned"), EntityStatus.APPROVED);

      assertEquals(EntityStatus.DRAFT, owned.getEntityStatus());
      assertEquals(EntityStatus.APPROVED, unowned.getEntityStatus());
    } finally {
      deleteWorkflow(workflow);
    }
  }

  /**
   * A workflow that sets the stage of entities of one type whose name contains the marker; its
   * trigger filter excludes every other entity of that type.
   */
  private static JsonNode createStageWorkflow(TestNamespace ns, String entityType) {
    JsonNodeFactory json = JsonNodeFactory.instance;
    ObjectNode trigger = json.objectNode().put("type", "eventBasedEntity");
    ObjectNode config = trigger.putObject("config");
    config.putArray("entityTypes").add(entityType);
    config.putArray("events").add("Created").add("Updated");
    config.putArray("exclude").add(Entity.FIELD_ENTITY_STATUS);
    config.putObject("filter").put(entityType, unlessNameContains(OWNED_MARKER));
    trigger.putArray("output").add("relatedEntity").add("updatedBy");

    ArrayNode nodes = json.arrayNode();
    nodes.addObject().put("type", "startEvent").put("subType", "startEvent").put("name", "start");
    ObjectNode setStage =
        nodes
            .addObject()
            .put("type", "automatedTask")
            .put("subType", "setEntityAttributeTask")
            .put("name", "setDraft");
    setStage.putObject("config").put("fieldName", "status").put("fieldValue", "Draft");
    setStage
        .putObject("inputNamespaceMap")
        .put("relatedEntity", "global")
        .put("updatedBy", "global");
    nodes.addObject().put("type", "endEvent").put("subType", "endEvent").put("name", "end");

    ArrayNode edges = json.arrayNode();
    edges.addObject().put("from", "start").put("to", "setDraft");
    edges.addObject().put("from", "setDraft").put("to", "end");

    ObjectNode workflow = json.objectNode();
    workflow.put("name", ns.prefix("stageWorkflow"));
    workflow.put("displayName", "Stage workflow");
    workflow.put("description", "Owns the lifecycle stage of marked " + entityType + " entities");
    workflow.set("trigger", trigger);
    workflow.set("nodes", nodes);
    workflow.set("edges", edges);
    workflow.putObject("config").put("storeStageStatus", false);
    return JsonUtils.readTree(execute(HttpMethod.POST, WORKFLOWS_PATH, workflow));
  }

  // The trigger filter is an exclusion: it excludes every entity whose name lacks the marker.
  private static String unlessNameContains(String marker) {
    return "{\"!\":[{\"in\":[\"" + marker + "\",{\"var\":\"name\"}]}]}";
  }

  private static void changeWorkflowState(JsonNode workflow, String action) {
    execute(
        HttpMethod.PUT, WORKFLOWS_PATH + "/name/" + name(workflow) + "/" + action, new HashMap<>());
  }

  private static void deleteWorkflow(JsonNode workflow) {
    execute(
        HttpMethod.DELETE,
        WORKFLOWS_PATH + "/" + workflow.get("id").asText() + "?hardDelete=true&recursive=true",
        null);
  }

  private static List<String> stageWorkflows(String entityType) {
    EntityLifecycleStages lifecycle =
        JsonUtils.readValue(
            execute(HttpMethod.GET, LIFECYCLE_STAGES_PATH, null), EntityLifecycleStages.class);
    return lifecycle.getEntityTypes().stream()
        .filter(type -> entityType.equals(type.getEntityType()))
        .findFirst()
        .map(EntityTypeLifecycle::getStageWorkflows)
        .orElse(List.of());
  }

  private static Domain createDomain(String name) {
    return client()
        .domains()
        .create(
            new CreateDomain()
                .withName(name)
                .withDomainType(CreateDomain.DomainType.AGGREGATE)
                .withDescription("Domain for workflow-owned stage tests"));
  }

  private static Domain domain(Domain domain) {
    return client().domains().get(domain.getId().toString());
  }

  private static Domain moveToStage(Domain domain, EntityStatus stage) {
    Domain current = domain(domain);
    current.setEntityStatus(stage);
    return client().domains().update(current.getId().toString(), current);
  }

  private static Page createArticle(String name, EntityStatus stage) throws Exception {
    Team organization = new TeamService(client().getHttpClient()).getByName("Organization", null);
    CreatePage request =
        new CreatePage()
            .withName(name)
            .withPageType(PageType.ARTICLE)
            .withDescription("Article for workflow-owned stage tests")
            .withPage(new Article())
            .withRelatedEntities(List.of(organization.getEntityReference()))
            .withEntityStatus(stage);
    return RestClient.admin().create(PAGES_PATH, request, Page.class);
  }

  private static String name(JsonNode workflow) {
    return workflow.get("name").asText();
  }

  private static String execute(HttpMethod method, String path, Object body) {
    return client().getHttpClient().executeForString(method, path, body);
  }

  private static OpenMetadataClient client() {
    return SdkClients.adminClient();
  }
}
