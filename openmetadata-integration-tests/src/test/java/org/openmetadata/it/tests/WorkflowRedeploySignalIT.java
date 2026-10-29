package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.awaitility.Awaitility;
import org.awaitility.core.ConditionTimeoutException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * Every update of a workflow definition redeploys it. An entity event handled while the workflow
 * redeploys must still start the workflow: the signal used to reach no live trigger version, so
 * the entity silently stayed in the stage it was created in.
 *
 * <p>Isolated because the workflow it deploys applies to every marked domain created meanwhile.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class WorkflowRedeploySignalIT {
  private static final String WORKFLOWS_PATH = "/v1/governance/workflowDefinitions";
  private static final String MARKER = "redeployed";
  private static final int DOMAINS_CREATED_DURING_REDEPLOYS = 20;
  private static final Duration STATUS_TIMEOUT = Duration.ofMinutes(3);

  @Test
  void entityCreatedWhileItsWorkflowRedeploysStillStartsTheWorkflow(TestNamespace ns) {
    ObjectNode request = stageWorkflowRequest(ns);
    JsonNode workflow = JsonUtils.readTree(execute(HttpMethod.POST, WORKFLOWS_PATH, request));
    AtomicBoolean creating = new AtomicBoolean(true);
    AtomicInteger redeploys = new AtomicInteger();
    CompletableFuture<Void> redeploying =
        CompletableFuture.runAsync(
            () -> {
              while (creating.get()) {
                request.put("description", "Redeploy " + redeploys.incrementAndGet());
                execute(HttpMethod.PUT, WORKFLOWS_PATH, request);
              }
            });
    try {
      List<Domain> domains = new ArrayList<>();
      for (int i = 0; i < DOMAINS_CREATED_DURING_REDEPLOYS; i++) {
        domains.add(createDomain(ns, ns.prefix(MARKER + i)));
      }
      creating.set(false);
      redeploying.join();
      assertTrue(redeploys.get() > 1, "the workflow must redeploy while the domains are created");
      assertTrue(
          domains.stream().noneMatch(domain -> domain.getEntityStatus() == EntityStatus.DRAFT),
          "Draft must come from the workflow, not from the stage a domain is created in");

      awaitWorkflowSetDraft(domains);
    } finally {
      creating.set(false);
      redeploying.join();
      execute(
          HttpMethod.DELETE,
          WORKFLOWS_PATH + "/" + workflow.get("id").asText() + "?hardDelete=true&recursive=true",
          null);
    }
  }

  private static void awaitWorkflowSetDraft(List<Domain> domains) {
    try {
      Awaitility.await("the workflow sets every marked domain to Draft")
          .atMost(STATUS_TIMEOUT)
          .pollInterval(Duration.ofSeconds(2))
          .until(() -> notDraft(domains).isEmpty());
    } catch (ConditionTimeoutException timeout) {
      throw new AssertionError(
          "Domains created during the redeploys never reached the workflow: " + notDraft(domains),
          timeout);
    }
  }

  private static Map<String, EntityStatus> notDraft(List<Domain> domains) {
    return domains.stream()
        .map(domain -> SdkClients.adminClient().domains().get(domain.getId().toString()))
        .filter(domain -> domain.getEntityStatus() != EntityStatus.DRAFT)
        .collect(Collectors.toMap(Domain::getName, Domain::getEntityStatus));
  }

  /** Sets every marked domain to Draft; its trigger filter excludes all other domains. */
  private static ObjectNode stageWorkflowRequest(TestNamespace ns) {
    JsonNodeFactory json = JsonNodeFactory.instance;
    ObjectNode trigger = json.objectNode().put("type", "eventBasedEntity");
    ObjectNode config = trigger.putObject("config");
    config.putArray("entityTypes").add(Entity.DOMAIN);
    config.putArray("events").add("Created");
    config.putArray("exclude").add(Entity.FIELD_ENTITY_STATUS);
    config
        .putObject("filter")
        .put(Entity.DOMAIN, "{\"!\":[{\"in\":[\"" + MARKER + "\",{\"var\":\"name\"}]}]}");
    trigger.putArray("output").add("relatedEntity").add("updatedBy");

    ArrayNode nodes = json.arrayNode();
    nodes.addObject().put("type", "startEvent").put("subType", "startEvent").put("name", "start");
    ObjectNode setDraft =
        nodes
            .addObject()
            .put("type", "automatedTask")
            .put("subType", "setEntityAttributeTask")
            .put("name", "setDraft");
    setDraft.putObject("config").put("fieldName", "status").put("fieldValue", "Draft");
    setDraft
        .putObject("inputNamespaceMap")
        .put("relatedEntity", "global")
        .put("updatedBy", "global");
    nodes.addObject().put("type", "endEvent").put("subType", "endEvent").put("name", "end");

    ArrayNode edges = json.arrayNode();
    edges.addObject().put("from", "start").put("to", "setDraft");
    edges.addObject().put("from", "setDraft").put("to", "end");

    ObjectNode workflow = json.objectNode();
    workflow.put("name", ns.prefix("redeployWorkflow"));
    workflow.put("displayName", "Redeployed workflow");
    workflow.put("description", "Sets marked domains to Draft");
    workflow.set("trigger", trigger);
    workflow.set("nodes", nodes);
    workflow.set("edges", edges);
    workflow.putObject("config").put("storeStageStatus", false);
    return workflow;
  }

  private static Domain createDomain(TestNamespace ns, String name) {
    return ns.trackRoot(
        Entity.DOMAIN,
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(name)
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Domain created while its workflow redeploys")));
  }

  private static String execute(HttpMethod method, String path, Object body) {
    return SdkClients.adminClient().getHttpClient().executeForString(method, path, body);
  }
}
