/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.ChangeRequestITSupport.PUBLISHED;
import static org.openmetadata.it.tests.ChangeRequestITSupport.awaitOpenApprovalTask;
import static org.openmetadata.it.tests.ChangeRequestITSupport.descriptionOf;
import static org.openmetadata.it.tests.ChangeRequestITSupport.filterScopedTo;
import static org.openmetadata.it.tests.ChangeRequestITSupport.gatedGlossary;
import static org.openmetadata.it.tests.ChangeRequestITSupport.generateBotToken;
import static org.openmetadata.it.tests.ChangeRequestITSupport.listTasks;
import static org.openmetadata.it.tests.ChangeRequestITSupport.onlyPendingRequest;
import static org.openmetadata.it.tests.ChangeRequestITSupport.openTaskFilters;
import static org.openmetadata.it.tests.ChangeRequestITSupport.patchAs;
import static org.openmetadata.it.tests.ChangeRequestITSupport.requestsFor;
import static org.openmetadata.it.tests.ChangeRequestITSupport.resolve;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * A bot's change starts only the workflows that list the bot in {@code triggeringBots}, and only a
 * bot an admin created can be listed.
 */
// Each test deploys its own workflows on glossaries, which receive the signals of every glossary
// event, so the class runs alone instead of beside the shared-lane tests.
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class WorkflowTriggeringBotsIT {
  private static final AtomicInteger SEQUENCE = new AtomicInteger();
  private static final String DEFAULT_MODE = "Default";
  private static final String ENFORCE_MODE = "Enforce";
  private static final String FROM_BOT = "from bot";
  private static final String DESCRIPTION_PATCH =
      "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"%s\"}]".formatted(FROM_BOT);
  private static final String WORKFLOWS_PATH = "/v1/governance/workflowDefinitions";

  @Test
  void listedBotsEditIsHeldForApproval(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    TestBot bot = TestBot.create(ns, "held");
    deployWorkflow(ns, ENFORCE_MODE, glossary, List.of(bot.name()));

    patchAs(bot.client(), glossary.getId(), DESCRIPTION_PATCH);

    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
    assertEquals(bot.userName(), onlyPendingRequest(glossary.getId()).getRequestedBy());
  }

  @Test
  void everyBotAWorkflowListsHasItsEditHeld(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    TestBot first = TestBot.create(ns, "mfa");
    TestBot second = TestBot.create(ns, "mfb");
    deployWorkflow(ns, ENFORCE_MODE, glossary, List.of(first.name(), second.name()));

    patchAs(first.client(), glossary.getId(), DESCRIPTION_PATCH);
    patchAs(second.client(), glossary.getId(), DESCRIPTION_PATCH);

    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
    assertEquals(
        Set.of(first.userName(), second.userName()),
        requestsFor(glossary.getId()).stream()
            .map(ChangeRequest::getRequestedBy)
            .collect(Collectors.toSet()));
  }

  /**
   * The flow the feature exists for: an automation writes as a bot an admin created, listed on the
   * seeded glossary term approval workflow. Its new term goes to review instead of skipping the
   * workflow, the asset link it adds is held while the term is not approved, and approving the term
   * releases that link.
   */
  @Test
  void listedBotsNewGlossaryTermIsReviewedAndApprovalReleasesItsHeldTag(TestNamespace ns) {
    TestBot bot = TestBot.create(ns, "term");
    WorkflowDefinition approval =
        SdkClients.adminClient().workflowDefinitions().getByName(GLOSSARY_TERM_APPROVAL);
    listBots(approval, List.of(bot.name()));
    try {
      Glossary glossary = gatedGlossary(ns);
      GlossaryTerm term =
          bot.client()
              .glossaryTerms()
              .create(
                  new CreateGlossaryTerm()
                      .withName(ns.shortPrefix("botterm"))
                      .withGlossary(glossary.getFullyQualifiedName())
                      .withDescription("Proposed by an automation"));
      awaitStatus(term, EntityStatus.IN_REVIEW);

      Table table = SdkClients.adminClient().tables().create(tableRequest(ns));
      bot.client()
          .tables()
          .patch(
              table.getId().toString(),
              JsonUtils.readTree(
                  "[{\"op\":\"add\",\"path\":\"/tags/-\",\"value\":%s}]"
                      .formatted(JsonUtils.pojoToJson(glossaryLabel(term)))));
      assertTrue(tagsOf(table).stream().noneMatch(t -> isTerm(t, term)), "held until approved");

      Task task = awaitOpenApprovalTask(term.getFullyQualifiedName());
      resolve(task.getId(), "approve", TaskResolutionType.Approved);

      awaitStatus(term, EntityStatus.APPROVED);
      Awaitility.await("the held tag shows once the term is approved")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .until(() -> tagsOf(table).stream().anyMatch(t -> isTerm(t, term)));
    } finally {
      listBots(approval, List.of());
    }
  }

  private static final String GLOSSARY_TERM_APPROVAL = "GlossaryTermApprovalWorkflow";

  // A seeded workflow is shared by the whole suite, so the bot list is set for one test and cleared
  // after it.
  private static void listBots(WorkflowDefinition workflow, List<String> bots) {
    String op = bots.isEmpty() ? "remove" : "add";
    String value = bots.isEmpty() ? "" : ",\"value\":%s".formatted(JsonUtils.pojoToJson(bots));
    SdkClients.adminClient()
        .workflowDefinitions()
        .patch(
            workflow.getId(),
            JsonUtils.readTree(
                "[{\"op\":\"%s\",\"path\":\"/trigger/config/triggeringBots\"%s}]"
                    .formatted(op, value)));
  }

  private static void awaitStatus(GlossaryTerm term, EntityStatus status) {
    Awaitility.await("term %s reaches %s".formatted(term.getName(), status))
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () ->
                status
                    == SdkClients.adminClient()
                        .glossaryTerms()
                        .get(term.getId().toString())
                        .getEntityStatus());
  }

  private static CreateTable tableRequest(TestNamespace ns) {
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    return new CreateTable()
        .withName(ns.shortPrefix("bottable"))
        .withDatabaseSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));
  }

  private static TagLabel glossaryLabel(GlossaryTerm term) {
    return new TagLabel()
        .withTagFQN(term.getFullyQualifiedName())
        .withSource(TagLabel.TagSource.GLOSSARY)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static List<TagLabel> tagsOf(Table table) {
    List<TagLabel> tags =
        SdkClients.adminClient().tables().get(table.getId().toString(), "tags").getTags();
    return tags == null ? List.of() : tags;
  }

  private static boolean isTerm(TagLabel tag, GlossaryTerm term) {
    return term.getFullyQualifiedName().equals(tag.getTagFQN());
  }

  @Test
  void unlistedBotsEditPublishesAsBefore(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    TestBot listed = TestBot.create(ns, "lst");
    TestBot other = TestBot.create(ns, "oth");
    deployWorkflow(ns, ENFORCE_MODE, glossary, List.of(listed.name()));

    patchAs(other.client(), glossary.getId(), DESCRIPTION_PATCH);

    assertEquals(FROM_BOT, descriptionOf(glossary.getId()));
    assertTrue(requestsFor(glossary.getId()).isEmpty());
  }

  @Test
  void listedBotsChangeStartsOnlyTheWorkflowThatListsIt(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    TestBot bot = TestBot.create(ns, "dfl");
    WorkflowDefinition listing = deployWorkflow(ns, DEFAULT_MODE, glossary, List.of(bot.name()));
    deployWorkflow(ns, DEFAULT_MODE, glossary, List.of());

    patchAs(bot.client(), glossary.getId(), DESCRIPTION_PATCH);

    String fqn = glossary.getFullyQualifiedName();
    Task task = awaitOpenApprovalTask(fqn);
    assertEquals(listing.getId(), task.getWorkflowDefinitionId());
    Awaitility.await("only the workflow that lists the bot runs")
        .during(Duration.ofSeconds(10))
        .atMost(Duration.ofSeconds(30))
        .until(() -> listTasks(openTaskFilters(fqn)).size() == 1);
  }

  @Test
  void systemBotCannotBeListed(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    InvalidRequestException error =
        assertThrows(
            InvalidRequestException.class,
            () -> deployWorkflow(ns, DEFAULT_MODE, glossary, List.of("ingestion-bot")));
    assertTrue(error.getMessage().contains("is a system bot"), error.getMessage());
  }

  @Test
  void applicationsBotCannotBeListed(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    String applicationBot = applicationBotName("SearchIndexingApplication");
    InvalidRequestException error =
        assertThrows(
            InvalidRequestException.class,
            () -> deployWorkflow(ns, DEFAULT_MODE, glossary, List.of(applicationBot)));
    assertTrue(error.getMessage().contains("is an application's bot"), error.getMessage());
  }

  @Test
  void updateThatListsASystemBotIsRefused(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns);
    WorkflowDefinition workflow = deployWorkflow(ns, DEFAULT_MODE, glossary, List.of());
    CreateWorkflowDefinition update =
        workflowRequest(workflow.getName(), DEFAULT_MODE, glossary, List.of("governance-bot"));
    InvalidRequestException error =
        assertThrows(
            InvalidRequestException.class,
            () ->
                SdkClients.adminClient()
                    .getHttpClient()
                    .execute(HttpMethod.PUT, WORKFLOWS_PATH, update, WorkflowDefinition.class));
    assertTrue(error.getMessage().contains("is a system bot"), error.getMessage());
  }

  private static String applicationBotName(String applicationName) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/apps/name/%s?fields=bot".formatted(applicationName),
            null,
            App.class)
        .getBot()
        .getName();
  }

  private static WorkflowDefinition deployWorkflow(
      TestNamespace ns, String approvalMode, Glossary glossary, List<String> triggeringBots) {
    // The workflow name becomes the BPMN process id, which must be a valid XML NCName.
    String name =
        "Wf%s".formatted(ns.shortPrefix("trigbots%d".formatted(SEQUENCE.incrementAndGet())));
    return ns.trackRoot(
        Entity.WORKFLOW_DEFINITION,
        SdkClients.adminClient()
            .workflowDefinitions()
            .create(workflowRequest(name, approvalMode, glossary, triggeringBots)));
  }

  /** Start -> Approve -> ApprovedEnd / RejectedEnd, on updates of {@code glossary} only. */
  private static CreateWorkflowDefinition workflowRequest(
      String name, String approvalMode, Glossary glossary, List<String> triggeringBots) {
    String json =
        """
        {
          "name": "%s",
          "displayName": "Triggering Bots Test Workflow",
          "description": "Reviews glossary edits, including those of the listed bots.",
          "config": {"storeStageStatus": true},
          "trigger": {
            "type": "eventBasedEntity",
            "config": {
              "approvalMode": "%s",
              "entityTypes": ["glossary"],
              "events": ["Updated"],
              "include": ["description"],
              "filter": %s,
              "triggeringBots": %s
            },
            "output": ["relatedEntity", "updatedBy"]
          },
          "nodes": [
            {"type": "startEvent", "subType": "startEvent", "name": "Start"},
            {"type": "userTask", "subType": "userApprovalTask", "name": "Approve",
             "config": {"assignees": {"addReviewers": true, "addOwners": false, "candidates": []},
                        "approvalThreshold": 1, "rejectionThreshold": 1, "stageId": "review",
                        "stageDisplayName": "Review", "taskStatus": "Open",
                        "assigneeStrategy": "reviewers-and-assignees",
                        "transitionMetadata": [
                          {"id": "approve", "label": "Approve", "targetStageId": "approved",
                           "targetTaskStatus": "Approved", "resolutionType": "Approved",
                           "formRef": "approve", "requiresComment": false},
                          {"id": "reject", "label": "Reject", "targetStageId": "rejected",
                           "targetTaskStatus": "Rejected", "resolutionType": "Rejected",
                           "formRef": "reject", "requiresComment": true}]},
             "inputNamespaceMap": {"relatedEntity": "global"}},
            {"type": "endEvent", "subType": "endEvent", "name": "ApprovedEnd"},
            {"type": "endEvent", "subType": "endEvent", "name": "RejectedEnd"}
          ],
          "edges": [
            {"from": "Start", "to": "Approve"},
            {"from": "Approve", "to": "ApprovedEnd", "condition": "approve"},
            {"from": "Approve", "to": "RejectedEnd", "condition": "reject"}
          ]
        }
        """
            .formatted(
                name,
                approvalMode,
                filterScopedTo(Entity.GLOSSARY, glossary.getFullyQualifiedName()),
                JsonUtils.pojoToJson(triggeringBots));
    return JsonUtils.readValue(json, CreateWorkflowDefinition.class);
  }

  /** A bot an admin created, with a client that writes as it. */
  private record TestBot(String name, String userName, OpenMetadataClient client) {
    static TestBot create(TestNamespace ns, String suffix) {
      // JwtFilter resolves a bot's user name from its email local-part, so the two match.
      String userName = "trigbot%s%s".formatted(suffix, ns.shortPrefix());
      User user = SdkClients.adminClient().users().create(botUserRequest(userName));
      String botName = ns.prefix("trigbot_%s".formatted(suffix));
      SdkClients.adminClient()
          .bots()
          .create(
              new CreateBot()
                  .withName(botName)
                  .withDescription("Bot whose changes a workflow lists")
                  .withBotUser(user.getName()));
      OpenMetadataConfig config =
          OpenMetadataConfig.builder()
              .serverUrl(SdkClients.baseUrl())
              .accessToken(generateBotToken(user))
              .build();
      return new TestBot(botName, user.getName(), new OpenMetadataClient(config));
    }

    // Admin, so the bot may edit any glossary without a policy set up for the test.
    private static CreateUser botUserRequest(String userName) {
      return new CreateUser()
          .withName(userName)
          .withEmail("%s@test.com".formatted(userName))
          .withDescription("Bot user for triggering-bot tests")
          .withIsBot(true)
          .withIsAdmin(true)
          .withAuthenticationMechanism(
              new AuthenticationMechanism()
                  .withAuthType(AuthenticationMechanism.AuthType.JWT)
                  .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited)));
    }
  }
}
