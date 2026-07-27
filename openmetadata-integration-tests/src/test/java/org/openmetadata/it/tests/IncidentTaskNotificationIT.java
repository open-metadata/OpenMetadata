/*
 *  Copyright 2024 Collate
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Verifies that a conversation/mention Notification alert scoped to the {@code task} source fires
 * when a user is @-mentioned in an incident (test-case-failure) task comment.
 *
 * <p>Regression guard for the task redesign: incident comments are {@code TaskComment}s on a Task
 * entity, so the comment must (1) emit a consumable {@code task} change event and (2) be matched by
 * the {@code matchConversationUser} filter. Without either, the alert never fires.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IncidentTaskNotificationIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String EVENT_SUBSCRIPTIONS_PATH = "/v1/events/subscriptions";
  private static final Duration TASK_TIMEOUT = Duration.ofSeconds(30);
  private static final Duration ALERT_TIMEOUT = Duration.ofSeconds(60);

  @Test
  void testTaskCommentMentionTriggersNotification(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String userName = "mw" + UUID.randomUUID().toString().substring(0, 8);
    User watcher =
        client
            .users()
            .create(new CreateUser().withName(userName).withEmail(userName + "@test.om.org"));
    assertNotNull(watcher);

    EventSubscription alert = createTaskMentionAlert(ns, client, userName);
    try {
      TestCase testCase = createTestCase(client, ns, "incident-notif");
      createFailedTestResult(client, testCase);
      Task incident = awaitIncidentTaskForTestCase(client, testCase);

      long processedBefore = processedEventsCount(client, alert);

      client
          .tasks()
          .addComment(
              incident.getId().toString(),
              "Please take a look <#E::user::" + userName + "> at this failing test");

      await("conversation/mention alert delivers the incident comment event")
          .atMost(ALERT_TIMEOUT)
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () ->
                  assertTrue(
                      processedEventsCount(client, alert) > processedBefore,
                      "task-source mention alert must process the incident comment notification"));
    } finally {
      client.eventSubscriptions().delete(alert.getId().toString());
    }
  }

  private EventSubscription createTaskMentionAlert(
      TestNamespace ns, OpenMetadataClient client, String userName) {
    ArgumentsInput mentionFilter =
        new ArgumentsInput()
            .withName("filterByMentionedName")
            .withEffect(ArgumentsInput.Effect.INCLUDE)
            .withArguments(
                List.of(new Argument().withName("userList").withInput(List.of(userName))));

    // Customer's destination shape: Email to the Mentions category. With SMTP disabled (CI default)
    // the publisher short-circuits as a successful delivery, so the assertion stays
    // sink-independent.
    SubscriptionDestination destination =
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionDestination.SubscriptionType.EMAIL)
            .withCategory(SubscriptionDestination.SubscriptionCategory.MENTIONS)
            .withConfig(new EmailAlertConfig());

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("task_mention_alert"))
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("task"))
            .withEnabled(true)
            .withBatchSize(10)
            .withPollInterval(1)
            .withInput(new AlertFilteringInput().withFilters(List.of(mentionFilter)))
            .withDestinations(List.of(destination));

    EventSubscription subscription = client.eventSubscriptions().create(request);
    assertNotNull(subscription.getId());
    assertEquals(List.of("task"), subscription.getFilteringRules().getResources());
    return subscription;
  }

  private long processedEventsCount(OpenMetadataClient client, EventSubscription alert)
      throws Exception {
    HttpClient httpClient = client.getHttpClient();
    String path = String.format("%s/id/%s/diagnosticInfo", EVENT_SUBSCRIPTIONS_PATH, alert.getId());
    String json =
        httpClient.executeForString(HttpMethod.GET, path, null, RequestOptions.builder().build());
    JsonNode node = MAPPER.readTree(json);
    return node.path("successfulEventsCount").asLong(0) + node.path("failedEventsCount").asLong(0);
  }

  private TestCase createTestCase(OpenMetadataClient client, TestNamespace ns, String prefix) {
    String id = ns.shortPrefix();
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName(prefix + "-svc-" + id, ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName(prefix + "-sch-" + id, ns, service);
    Table table =
        TableTestFactory.createSimpleWithName(
            prefix + "-tbl-" + id, ns, schema.getFullyQualifiedName());

    return TestCaseBuilder.create(client)
        .name(prefix + "-tc-" + id)
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();
  }

  private void createFailedTestResult(OpenMetadataClient client, TestCase testCase) {
    CreateTestCaseResult failedResult =
        new CreateTestCaseResult()
            .withTimestamp(System.currentTimeMillis())
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withResult("Test failed - triggering incident");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), failedResult);
  }

  private Task awaitIncidentTaskForTestCase(OpenMetadataClient client, TestCase testCase) {
    AtomicReference<Task> taskRef = new AtomicReference<>();
    await()
        .atMost(TASK_TIMEOUT)
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              Task task = findIncidentTaskForTestCase(client, testCase);
              assertNotNull(task, "incident task should be created for failed test case");
              assertEquals(TaskCategory.Incident, task.getCategory());
              taskRef.set(task);
            });
    return taskRef.get();
  }

  private Task findIncidentTaskForTestCase(OpenMetadataClient client, TestCase testCase) {
    ListParams params =
        new ListParams().setLimit(200).setFields("payload,about").addFilter("category", "Incident");
    ListResponse<Task> tasks = client.tasks().list(params);
    return tasks.getData().stream()
        .filter(task -> task.getAbout() != null)
        .filter(task -> task.getAbout().getFullyQualifiedName() != null)
        .filter(
            task ->
                task.getAbout().getFullyQualifiedName().equals(testCase.getFullyQualifiedName()))
        .findFirst()
        .orElse(null);
  }
}
