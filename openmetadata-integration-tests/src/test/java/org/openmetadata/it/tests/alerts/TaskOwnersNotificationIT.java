package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory.OWNERS;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.DescriptionUpdatePayload;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;

/**
 * A task has no owners of its own: Owners on a task alert reaches the task's creator and the owners
 * of the entity it is about, as on a conversation alert. Each user is reached through the webhook
 * on their profile. Isolated because it drives a tick over a source every task event matches.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class TaskOwnersNotificationIT {

  private static final int ONE_DAY_SECONDS = 86400;
  private static final Duration WORKFLOW_TIMEOUT = Duration.ofSeconds(60);

  @Test
  void ownersOfATaskAreItsCreatorAndTheOwnersOfWhatItIsAbout(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      User creator = userReachedAt(ns, "creator", receiver.url("/creator"));
      User steward = userReachedAt(ns, "steward", receiver.url("/steward"));
      Table table = tableOwnedBy(ns, steward);
      EventSubscription alert = taskOwnersAlert(ns);
      QuietAlert.settle(alert);

      Task task = clientOf(creator).tasks().create(descriptionUpdate(ns, table));
      awaitWorkflowBound(task.getId());
      SdkClients.adminClient()
          .tasks()
          .resolve(
              task.getId().toString(),
              new ResolveTask()
                  .withResolutionType(TaskResolutionType.Approved)
                  .withNewValue("approved description"));
      DirectTick.run(alert);

      Set<EventType> filedAndResolved = Set.of(EventType.ENTITY_CREATED, EventType.ENTITY_UPDATED);
      assertEquals(filedAndResolved, eventTypesOf(receiver, "/creator", task.getId()));
      assertEquals(filedAndResolved, eventTypesOf(receiver, "/steward", task.getId()));
    }
  }

  private static Set<EventType> eventTypesOf(RecordingReceiver receiver, String path, UUID taskId) {
    return receiver.received().stream()
        .filter(request -> path.equals(request.path()))
        .map(request -> JsonUtils.readTree(request.body()))
        .filter(event -> taskId.toString().equals(event.get("entityId").asText()))
        .map(event -> EventType.fromValue(event.get("eventType").asText()))
        .collect(Collectors.toSet());
  }

  private static User userReachedAt(TestNamespace ns, String name, String endpoint) {
    String unique = name + ns.uniqueShortId();
    Profile profile =
        new Profile()
            .withSubscription(
                new SubscriptionConfig()
                    .withGeneric(new Webhook().withEndpoint(URI.create(endpoint))));
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(unique)
                .withEmail(unique + "@test.om.org")
                .withProfile(profile));
  }

  private static OpenMetadataClient clientOf(User user) {
    return SdkClients.createClient(user.getName(), user.getEmail(), new String[] {});
  }

  private static Table tableOwnedBy(TestNamespace ns, User owner) {
    String id = ns.uniqueShortId();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("sv" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("sc" + id, ns, service);
    Table table =
        TableTestFactory.createSimpleWithName("tb" + id, ns, schema.getFullyQualifiedName());
    table.setOwners(List.of(owner.getEntityReference()));
    return SdkClients.adminClient().tables().update(table.getId().toString(), table);
  }

  private static EventSubscription taskOwnersAlert(TestNamespace ns) {
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("task_owners"))
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of(Entity.TASK))
            .withEnabled(true)
            .withBatchSize(100)
            .withPollInterval(ONE_DAY_SECONDS)
            .withDestinations(
                List.of(
                    new SubscriptionDestination()
                        .withType(WEBHOOK)
                        .withCategory(OWNERS)
                        .withConfig(new Webhook())));
    return AlertFixtures.stored(
        SdkClients.adminClient().eventSubscriptions().create(request).getId());
  }

  private static CreateTask descriptionUpdate(TestNamespace ns, Table table) {
    return new CreateTask()
        .withName(ns.prefix("description-update"))
        .withCategory(TaskCategory.MetadataUpdate)
        .withType(TaskEntityType.DescriptionUpdate)
        .withAbout("<#E::table::%s>".formatted(table.getFullyQualifiedName()))
        .withPayload(
            new DescriptionUpdatePayload()
                .withFieldPath("description")
                .withCurrentDescription(table.getDescription())
                .withNewDescription("approved description"));
  }

  private static void awaitWorkflowBound(UUID taskId) {
    Awaitility.await("task %s bound to its workflow".formatted(taskId))
        .atMost(WORKFLOW_TIMEOUT)
        .pollInterval(Duration.ofMillis(500))
        .until(
            () ->
                SdkClients.adminClient().tasks().get(taskId.toString()).getWorkflowInstanceId()
                        != null
                    && WorkflowHandler.getInstance().hasActiveRuntimeTask(taskId));
  }
}
