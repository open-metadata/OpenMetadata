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

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.util.ChangePreviewUtils;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.util.EntityUtil;

/**
 * The Proposed Changes card of an approval task lists what the entity changed since its approval
 * cycle began: the last version a reviewer accepted, up to the version under review. It must not
 * repeat a stale preview, drop an edit that started no run, or carry an earlier cycle forward.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class ApprovalTaskPreviewIT {

  private static final String GLOSSARY_WORKFLOW = "GlossaryTermApprovalWorkflow";
  private static final String DESCRIPTION = "description";
  private static final String SYNONYMS = "synonyms";
  private static final String FINISHED = "FINISHED";
  private static final Duration TIMEOUT = Duration.ofMinutes(3);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(1);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final TypeReference<Map<String, Map<String, List<String>>>> PREVIEW_TYPE =
      new TypeReference<>() {};

  // The issue's first report: each new cycle shows only its own edit, never the earlier cycle's.
  @Test
  void aSecondApprovalCycleOnAGlossaryTermPreviewsOnlyItsOwnEdit(TestNamespace ns)
      throws Exception {
    GlossaryTerm term = approvedTerm(ns, "second_cycle", "Original definition");
    String first = "Edited definition";
    String second = first + " This is a test";
    String third = second + " This is a test";

    editDescription(SdkClients.adminClient(), term, first);
    approve(awaitPreview(term, Map.of(DESCRIPTION, replaced(first, "Original definition"))), term);
    editDescription(SdkClients.adminClient(), term, second);
    approve(awaitPreview(term, Map.of(DESCRIPTION, replaced(second, first))), term);
    editDescription(SdkClients.adminClient(), term, third);

    awaitPreview(term, Map.of(DESCRIPTION, replaced(third, second)));
  }

  // The issue's second report: the workflow's own move to In Review is not the edit under review.
  @Test
  void anApprovedMetricEditedByANonReviewerPreviewsTheEditedDescription(TestNamespace ns)
      throws Exception {
    Metric metric = approvedMetric(ns, "Revenue booked in the month");
    String edited = "Revenue recognized in the month";

    SdkClients.adminClient().metrics().patch(metric.getId().toString(), descriptionPatch(edited));

    awaitPreview(
        metric.getFullyQualifiedName(),
        Map.of(DESCRIPTION, replaced(edited, "Revenue booked in the month")));
  }

  @Test
  void anEditWhileTheTaskIsOpenSupersedesItWithTheWholeCycle(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns, "superseded", "Original definition");

    editDescription(SdkClients.adminClient(), term, "Edited definition");
    Task opened =
        awaitPreview(
            term, Map.of(DESCRIPTION, replaced("Edited definition", "Original definition")));
    addSynonym(SdkClients.adminClient(), term, "Alias");
    Task superseding =
        awaitPreview(
            term,
            Map.of(
                DESCRIPTION,
                replaced("Edited definition", "Original definition"),
                SYNONYMS,
                added("Alias")));
    editDescription(stewardClient(ns), term, "Stewarded definition");

    Task last =
        awaitPreview(
            term,
            Map.of(
                DESCRIPTION,
                replaced("Stewarded definition", "Original definition"),
                SYNONYMS,
                added("Alias")));
    assertNotEquals(opened.getId(), superseding.getId());
    assertNotEquals(superseding.getId(), last.getId());
  }

  // A preview stored on the open task, here one listing only a status move, is not the base the
  // next task builds on: the next task lists every change since the cycle began.
  @Test
  void aStalePreviewOnTheOpenTaskIsNotCarriedIntoTheNextTask(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns, "stale_preview", "Original definition");
    editDescription(SdkClients.adminClient(), term, "Edited definition");
    Task opened =
        awaitPreview(
            term, Map.of(DESCRIPTION, replaced("Edited definition", "Original definition")));
    SdkClients.adminClient()
        .tasks()
        .patch(
            opened.getId().toString(),
            MAPPER.readTree(
                """
                [{"op":"replace","path":"/payload/%s",
                  "value":{"entityStatus":{"added":["In Review"],"removed":["Approved"]}}}]
                """
                    .formatted(ChangePreviewUtils.PROPOSED_CHANGES_KEY)));

    addSynonym(SdkClients.adminClient(), term, "Alias");

    Task next =
        awaitPreview(
            term,
            Map.of(
                DESCRIPTION,
                replaced("Edited definition", "Original definition"),
                SYNONYMS,
                added("Alias")));
    assertNotEquals(opened.getId(), next.getId());
  }

  // A bot's edit starts no run, but the reviewer approves it with the rest of the cycle, so the
  // next
  // task lists it.
  @Test
  void aBotEditDuringTheCycleIsInTheNextPreview(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns, "bot_edit", "Original definition");
    editDescription(SdkClients.adminClient(), term, "Edited definition");
    awaitPreview(term, Map.of(DESCRIPTION, replaced("Edited definition", "Original definition")));
    editDescription(SdkClients.ingestionBotClient(), term, "Ingested definition");

    addSynonym(SdkClients.adminClient(), term, "Alias");

    awaitPreview(
        term,
        Map.of(
            DESCRIPTION,
            replaced("Ingested definition", "Original definition"),
            SYNONYMS,
            added("Alias")));
  }

  // A reviewer's own edit is approved as it is made, so the next cycle starts from it.
  @Test
  void aReviewerEditBetweenCyclesBecomesTheNextBase(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns, "reviewer_base", "Original definition");
    editDescription(SdkClients.user1Client(), term, "Reviewed definition");
    awaitFinishedRuns(term, 2);
    assertEquals(EntityStatus.APPROVED, termStatus(term));

    editDescription(SdkClients.adminClient(), term, "Edited definition");

    awaitPreview(term, Map.of(DESCRIPTION, replaced("Edited definition", "Reviewed definition")));
  }

  // The history lost the cycle's first edit. The next task compares the version the cycle began
  // from with the current one, so the reviewer still sees that edit.
  @Test
  void aVersionMissingFromTheHistoryStillPreviewsTheWholeCycle(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns, "missing_version", "Original definition");
    editDescription(SdkClients.adminClient(), term, "Edited definition");
    Task opened =
        awaitPreview(
            term, Map.of(DESCRIPTION, replaced("Edited definition", "Original definition")));
    dropVersion(term, firstEditOf(term, baseOf(opened)));

    addSynonym(SdkClients.adminClient(), term, "Alias");

    Task next =
        awaitPreview(
            term,
            Map.of(
                DESCRIPTION,
                replaced("Edited definition", "Original definition"),
                SYNONYMS,
                added("Alias")));
    assertFalse(isMarkedIncomplete(next));
  }

  // Without the version the cycle began from there is nothing to compare with, so the task lists
  // the changes after the gap and says the list is incomplete.
  @Test
  void aCycleWhoseBaseIsMissingFromTheHistoryIsMarkedIncomplete(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns, "missing_base", "Original definition");
    editDescription(SdkClients.adminClient(), term, "Edited definition");
    Task opened =
        awaitPreview(
            term, Map.of(DESCRIPTION, replaced("Edited definition", "Original definition")));
    double base = baseOf(opened);
    dropVersion(term, firstEditOf(term, base));
    dropVersion(term, base);

    addSynonym(SdkClients.adminClient(), term, "Alias");

    assertTrue(isMarkedIncomplete(awaitPreview(term, Map.of(SYNONYMS, added("Alias")))));
  }

  private static GlossaryTerm approvedTerm(TestNamespace ns, String name, String description)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            admin
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.shortPrefix("preview_" + name))
                        .withDescription("Glossary for the approval preview tests")));
    GlossaryTerm term =
        admin
            .glossaryTerms()
            .create(
                new CreateGlossaryTerm()
                    .withName(name)
                    .withGlossary(glossary.getFullyQualifiedName())
                    .withDescription(description)
                    .withReviewers(List.of(SharedEntities.get().USER1_REF)));
    approve(awaitPreview(term, Map.of()), term);
    return term;
  }

  private static Metric approvedMetric(TestNamespace ns, String description) throws Exception {
    Metric metric =
        SdkClients.adminClient()
            .metrics()
            .create(
                new CreateMetric()
                    .withName(ns.prefix("preview_metric"))
                    .withDescription(description)
                    .withReviewers(List.of(SharedEntities.get().USER1_REF)));
    Task created = awaitPreview(metric.getFullyQualifiedName(), Map.of());
    approve(
        created,
        metric.getFullyQualifiedName(),
        () -> SdkClients.adminClient().metrics().get(metric.getId().toString()).getEntityStatus());
    return metric;
  }

  private static void approve(Task task, GlossaryTerm term) {
    approve(task, term.getFullyQualifiedName(), () -> termStatus(term));
  }

  private static void approve(Task task, String aboutFqn, Supplier<EntityStatus> status) {
    SdkClients.user1Client()
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask().withResolutionType(TaskResolutionType.Approved));
    await("approval of " + aboutFqn)
        .atMost(TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              assertEquals(EntityStatus.APPROVED, status.get());
              assertTrue(openApprovals(aboutFqn).isEmpty());
            });
  }

  private static EntityStatus termStatus(GlossaryTerm term) {
    return SdkClients.adminClient().glossaryTerms().get(term.getId().toString()).getEntityStatus();
  }

  private static Task awaitPreview(
      GlossaryTerm term, Map<String, Map<String, List<String>>> expected) {
    return awaitPreview(term.getFullyQualifiedName(), expected);
  }

  // Each edit is awaited before the next, as a user editing in the UI waits for the page.
  private static Task awaitPreview(
      String aboutFqn, Map<String, Map<String, List<String>>> expected) {
    AtomicReference<Task> shown = new AtomicReference<>();
    await("approval preview of " + aboutFqn + " to be " + expected)
        .atMost(TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              List<Task> open = openApprovals(aboutFqn);
              assertEquals(1, open.size());
              assertEquals(expected, proposedChanges(open.getFirst()));
              shown.set(open.getFirst());
            });
    return shown.get();
  }

  private static List<Task> openApprovals(String aboutFqn) {
    List<Task> tasks =
        SdkClients.adminClient()
            .tasks()
            .listWithFilters(
                Map.of(
                    "limit",
                    "100",
                    "status",
                    TaskEntityStatus.Open.value(),
                    "category",
                    TaskCategory.Approval.value(),
                    "aboutEntity",
                    aboutFqn))
            .getData();
    return tasks == null ? List.of() : tasks;
  }

  private static Map<String, Map<String, List<String>>> proposedChanges(Task task) {
    Object preview =
        task.getPayload() == null
            ? null
            : JsonUtils.getMap(task.getPayload()).get(ChangePreviewUtils.PROPOSED_CHANGES_KEY);
    return preview == null ? Map.of() : JsonUtils.convertValue(preview, PREVIEW_TYPE);
  }

  private static double baseOf(Task task) {
    return ChangePreviewUtils.cycleBaseOf(task.getPayload()).orElseThrow();
  }

  // The cycle's first edit is the oldest version after the one the cycle began from.
  private static double firstEditOf(GlossaryTerm term, double base) throws Exception {
    return SdkClients.adminClient()
        .glossaryTerms()
        .getVersionList(term.getId())
        .getVersions()
        .stream()
        .map(
            stored ->
                JsonUtils.readTree(
                    stored instanceof String json ? json : JsonUtils.pojoToJson(stored)))
        .mapToDouble(stored -> stored.path("version").asDouble())
        .filter(version -> version > base)
        .min()
        .orElseThrow();
  }

  // The row must be there to drop, or the test would pass without a gap in the history.
  private static void dropVersion(GlossaryTerm term, double version) {
    String extension = EntityUtil.getVersionExtension(Entity.GLOSSARY_TERM, version);
    EntityExtensionDAO versions = Entity.getCollectionDAO().entityExtensionDAO();
    assertNotNull(versions.getExtension(term.getId(), extension));
    versions.delete(term.getId(), extension);
  }

  private static boolean isMarkedIncomplete(Task task) {
    return Boolean.TRUE.equals(
        JsonUtils.getMap(task.getPayload())
            .get(ChangePreviewUtils.PROPOSED_CHANGES_INCOMPLETE_KEY));
  }

  private static Map<String, List<String>> replaced(String newValue, String oldValue) {
    return Map.of("added", List.of(newValue), "removed", List.of(oldValue));
  }

  private static Map<String, List<String>> added(String value) {
    return Map.of("added", List.of(value), "removed", List.of());
  }

  private static void editDescription(OpenMetadataClient client, GlossaryTerm term, String value)
      throws Exception {
    client.glossaryTerms().patch(term.getId().toString(), descriptionPatch(value));
  }

  private static JsonNode descriptionPatch(String value) throws Exception {
    return MAPPER.readTree(
        MAPPER
            .createArrayNode()
            .add(
                MAPPER
                    .createObjectNode()
                    .put("op", "replace")
                    .put("path", "/" + DESCRIPTION)
                    .put("value", value))
            .toString());
  }

  private static void addSynonym(OpenMetadataClient client, GlossaryTerm term, String synonym)
      throws Exception {
    client
        .glossaryTerms()
        .patch(
            term.getId().toString(),
            MAPPER.readTree(
                "[{\"op\":\"add\",\"path\":\"/%s\",\"value\":[\"%s\"]}]"
                    .formatted(SYNONYMS, synonym)));
  }

  // The shared steward client only mints a token, so the account is created here.
  private static OpenMetadataClient stewardClient(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String name = "preview_steward_" + UUID.randomUUID().toString().substring(0, 8);
    CreateUser createUser =
        new CreateUser()
            .withName(name)
            .withEmail(name + "@test.om.org")
            .withRoles(List.of(admin.roles().getByName("DataSteward").getId()));
    User steward = ns.trackRoot(Entity.USER, admin.users().create(createUser));
    return SdkClients.createClient(
        steward.getName(), steward.getEmail(), new String[] {"DataSteward"});
  }

  private static void awaitFinishedRuns(GlossaryTerm term, int runs) {
    await(runs + " finished approval runs on " + term.getFullyQualifiedName())
        .atMost(TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(() -> assertEquals(Collections.nCopies(runs, FINISHED), runStatuses(term)));
  }

  private static List<String> runStatuses(GlossaryTerm term) throws Exception {
    long now = System.currentTimeMillis();
    RequestOptions options =
        RequestOptions.builder()
            .queryParam(
                "entityLink",
                "<#E::%s::%s>".formatted(Entity.GLOSSARY_TERM, term.getFullyQualifiedName()))
            .queryParam("workflowDefinitionName", GLOSSARY_WORKFLOW)
            .queryParam("startTs", String.valueOf(now - Duration.ofHours(1).toMillis()))
            .queryParam("endTs", String.valueOf(now + Duration.ofHours(1).toMillis()))
            .queryParam("limit", "50")
            .build();
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/governance/workflowInstances", null, options);
    List<String> statuses = new ArrayList<>();
    for (JsonNode instance : MAPPER.readTree(response).path("data")) {
      statuses.add(instance.path("status").asText());
    }
    return statuses;
  }
}
