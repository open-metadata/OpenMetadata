/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * A stored glossary approval workflow without the automation branch, such as one saved before
 * 2.1.0 or one an admin customised, approves a term in a glossary without reviewers as whoever
 * created it. For an AI agent's proposal that is a bot, and the repository refuses a bot's approval
 * of an automation term, so the proposal is never published without a person.
 */
@Isolated("Replaces the shared glossary approval workflow while it runs")
@ExtendWith(TestNamespaceExtension.class)
class GlossaryTermUnmigratedApprovalWorkflowIT {
  private static final String APPROVAL_WORKFLOW = "GlossaryTermApprovalWorkflow";
  private static final String WORKFLOW_PATH =
      "/v1/governance/workflowDefinitions/name/" + APPROVAL_WORKFLOW;
  private static final String START_EVENT = "startEvent";
  private static final String HAND_BACK_CONDITION = "false";
  private static final String RUNNING = "RUNNING";
  private static final Duration WORKFLOW_TIMEOUT = Duration.ofMinutes(3);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  @Test
  void aWorkflowWithoutTheAutomationBranchNeverApprovesABotsProposal(TestNamespace ns) {
    JsonNode stored = storedWorkflow();
    // Inside the try: a failed deploy can leave the stripped graph stored.
    try {
      replaceGraph(withoutAutomationBranch(stored));
      Glossary glossary = createGlossaryWithoutReviewers(ns);
      GlossaryTerm proposal = createProposalAsBot(glossary, ns.prefix("proposal"));

      awaitEndedApprovalRun(proposal);

      assertEquals(EntityStatus.DRAFT, reload(proposal).getEntityStatus());
    } finally {
      replaceGraph(stored);
    }
  }

  private static JsonNode storedWorkflow() {
    return JsonUtils.readTree(
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, WORKFLOW_PATH, null));
  }

  private static void replaceGraph(JsonNode workflow) {
    ArrayNode patch = JsonNodeFactory.instance.arrayNode();
    patch
        .addObject()
        .put("op", "replace")
        .put("path", "/nodes")
        .set("value", workflow.path("nodes"));
    patch
        .addObject()
        .put("op", "replace")
        .put("path", "/edges")
        .set("value", workflow.path("edges"));
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(HttpMethod.PATCH, WORKFLOW_PATH, patch);
  }

  /**
   * The workflow as it was before the branch: the start leads straight to the step the branch hands
   * back to on its "false" edge, and none of the branch's nodes remain.
   */
  private static JsonNode withoutAutomationBranch(JsonNode stored) {
    String start = startNode(stored);
    String entry = edgesFrom(stored, start).getFirst().path("to").asText();
    String handBack = handBackOf(stored, entry);
    Set<String> branch = reachableBefore(stored, entry, handBack);
    ObjectNode workflow = JsonNodeFactory.instance.objectNode();
    ArrayNode nodes = workflow.putArray("nodes");
    elements(stored.path("nodes"))
        .filter(node -> !branch.contains(node.path("name").asText()))
        .forEach(nodes::add);
    ArrayNode edges = workflow.putArray("edges");
    edges.addObject().put("from", start).put("to", handBack);
    elements(stored.path("edges")).filter(edge -> !touches(edge, branch)).forEach(edges::add);
    return workflow;
  }

  private static String startNode(JsonNode workflow) {
    return elements(workflow.path("nodes"))
        .filter(node -> START_EVENT.equals(node.path("type").asText()))
        .map(node -> node.path("name").asText())
        .findFirst()
        .orElseThrow();
  }

  private static String handBackOf(JsonNode workflow, String entry) {
    return edgesFrom(workflow, entry).stream()
        .filter(edge -> HAND_BACK_CONDITION.equals(edge.path("condition").asText()))
        .map(edge -> edge.path("to").asText())
        .findFirst()
        .orElseThrow();
  }

  private static List<JsonNode> edgesFrom(JsonNode workflow, String node) {
    return elements(workflow.path("edges"))
        .filter(edge -> node.equals(edge.path("from").asText()))
        .toList();
  }

  private static Set<String> reachableBefore(JsonNode workflow, String entry, String handBack) {
    Set<String> reached = new HashSet<>();
    Deque<String> pending = new ArrayDeque<>(List.of(entry));
    while (!pending.isEmpty()) {
      String node = pending.pop();
      if (!node.equals(handBack) && reached.add(node)) {
        edgesFrom(workflow, node).forEach(edge -> pending.push(edge.path("to").asText()));
      }
    }
    return reached;
  }

  private static boolean touches(JsonNode edge, Set<String> nodes) {
    return nodes.contains(edge.path("from").asText()) || nodes.contains(edge.path("to").asText());
  }

  private static Stream<JsonNode> elements(JsonNode array) {
    return StreamSupport.stream(array.spliterator(), false);
  }

  private static Glossary createGlossaryWithoutReviewers(TestNamespace ns) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("unmigrated"))
            .withDescription("A glossary without reviewers or owners");
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private static GlossaryTerm createProposalAsBot(Glossary glossary, String name) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withDescription("A business concept an agent proposed")
            .withGlossary(glossary.getFullyQualifiedName())
            .withProvider(ProviderType.AUTOMATION);
    return SdkClients.botClient().glossaryTerms().create(create);
  }

  private static void awaitEndedApprovalRun(GlossaryTerm term) {
    Awaitility.await("an ended approval run for " + term.getFullyQualifiedName())
        .atMost(WORKFLOW_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .until(
            () -> approvalRunStatuses(term),
            statuses -> !statuses.isEmpty() && !statuses.contains(RUNNING));
  }

  private static List<String> approvalRunStatuses(GlossaryTerm term) {
    long now = System.currentTimeMillis();
    RequestOptions options =
        RequestOptions.builder()
            .queryParam(
                "entityLink",
                String.format("<#E::%s::%s>", Entity.GLOSSARY_TERM, term.getFullyQualifiedName()))
            .queryParam("workflowDefinitionName", APPROVAL_WORKFLOW)
            .queryParam("startTs", String.valueOf(now - Duration.ofHours(1).toMillis()))
            .queryParam("endTs", String.valueOf(now + Duration.ofHours(1).toMillis()))
            .queryParam("limit", "50")
            .build();
    JsonNode runs =
        JsonUtils.readTree(
            SdkClients.adminClient()
                .getHttpClient()
                .executeForString(
                    HttpMethod.GET, "/v1/governance/workflowInstances", null, options));
    return elements(runs.path("data")).map(run -> run.path("status").asText()).toList();
  }

  private static GlossaryTerm reload(GlossaryTerm term) {
    return SdkClients.adminClient().glossaryTerms().get(term.getId().toString());
  }
}
