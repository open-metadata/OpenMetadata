package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory.OWNERS;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.AlertType;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerting.AlertDiagnostics;

/**
 * Notify Downstream on an alert for a data asset: lineage runs first to second to third, each table
 * owned by a team reached through the webhook on its profile. Isolated because it drives a tick over
 * a source every table event matches.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class NotifyDownstreamIT {

  private static final int ONE_DAY_SECONDS = 86400;

  private record Chain(Table first, Table second, Table third) {}

  @Test
  void reachesTheOwnersOfEveryTableDownstream(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      Chain chain = chain(ns, receiver);
      EventSubscription alert = ownersAlert(ns, "all_the_way", true, null);
      QuietAlert.settle(alert);

      change(chain.first());
      DirectTick.run(alert);

      assertEquals(
          Set.of("/first", "/second", "/third"), pathsReached(receiver, chain.first().getId()));
    }
  }

  @Test
  void depthLimitsHowFarDownstreamItReaches(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      Chain chain = chain(ns, receiver);
      EventSubscription alert = ownersAlert(ns, "one_step", true, 1);
      QuietAlert.settle(alert);

      change(chain.first());
      DirectTick.run(alert);

      assertEquals(Set.of("/first", "/second"), pathsReached(receiver, chain.first().getId()));
    }
  }

  @Test
  void turnedOffReachesOnlyTheOwnersOfTheChangedTable(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      Chain chain = chain(ns, receiver);
      EventSubscription alert = ownersAlert(ns, "off", false, null);
      QuietAlert.settle(alert);

      change(chain.first());
      DirectTick.run(alert);

      assertEquals(Set.of("/first"), pathsReached(receiver, chain.first().getId()));
    }
  }

  @Test
  void aSoftDeletedTableStillReachesItsDownstreamOwners(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      Chain chain = chain(ns, receiver);
      EventSubscription alert = ownersAlert(ns, "soft_delete", true, 1);
      QuietAlert.settle(alert);

      SdkClients.adminClient().tables().delete(chain.first().getId().toString());
      DirectTick.run(alert);

      assertEquals(Set.of("/first", "/second"), pathsReached(receiver, chain.first().getId()));
      assertEquals(0, AlertDiagnostics.eventsRecord(alert.getId()).getFailedEventsCount());
    }
  }

  private static Set<String> pathsReached(RecordingReceiver receiver, UUID tableId) {
    return receiver.received().stream()
        .filter(
            request ->
                tableId
                    .toString()
                    .equals(JsonUtils.readTree(request.body()).get("entityId").asText()))
        .map(RecordingReceiver.Received::path)
        .collect(Collectors.toSet());
  }

  private static void change(Table table) {
    table.setDescription("changed " + UUID.randomUUID());
    SdkClients.adminClient().tables().update(table.getId().toString(), table);
  }

  private static Chain chain(TestNamespace ns, RecordingReceiver receiver) {
    String id = ns.uniqueShortId();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("sv" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("sc" + id, ns, service);
    String schemaFqn = schema.getFullyQualifiedName();
    Table first = ownedTable(ns, schemaFqn, "first", receiver);
    Table second = ownedTable(ns, schemaFqn, "second", receiver);
    Table third = ownedTable(ns, schemaFqn, "third", receiver);
    lineage(first, second);
    lineage(second, third);
    return new Chain(first, second, third);
  }

  private static Table ownedTable(
      TestNamespace ns, String schemaFqn, String name, RecordingReceiver receiver) {
    String unique = name + ns.uniqueShortId();
    Team owner = teamReachedAt(unique, receiver.url("/" + name));
    Table table = TableTestFactory.createSimpleWithName(unique, ns, schemaFqn);
    table.setOwners(List.of(owner.getEntityReference()));
    return SdkClients.adminClient().tables().update(table.getId().toString(), table);
  }

  private static Team teamReachedAt(String name, String endpoint) {
    Profile profile =
        new Profile()
            .withSubscription(
                new SubscriptionConfig()
                    .withGeneric(new Webhook().withEndpoint(URI.create(endpoint))));
    return SdkClients.adminClient()
        .teams()
        .create(
            new CreateTeam()
                .withName(name)
                .withTeamType(CreateTeam.TeamType.GROUP)
                .withProfile(profile));
  }

  private static void lineage(Table from, Table to) {
    EntitiesEdge edge =
        new EntitiesEdge().withFromEntity(reference(from)).withToEntity(reference(to));
    SdkClients.adminClient().lineage().addLineage(new AddLineage().withEdge(edge));
  }

  private static EntityReference reference(Table table) {
    return new EntityReference().withId(table.getId()).withType(Entity.TABLE);
  }

  private static EventSubscription ownersAlert(
      TestNamespace ns, String name, boolean notifyDownstream, Integer depth) {
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix(name))
            .withAlertType(AlertType.NOTIFICATION)
            .withResources(List.of(Entity.TABLE))
            .withEnabled(true)
            .withBatchSize(100)
            .withPollInterval(ONE_DAY_SECONDS)
            .withDestinations(
                List.of(
                    new SubscriptionDestination()
                        .withType(WEBHOOK)
                        .withCategory(OWNERS)
                        .withNotifyDownstream(notifyDownstream)
                        .withDownstreamDepth(depth)
                        .withConfig(new Webhook())));
    return AlertFixtures.stored(
        SdkClients.adminClient().eventSubscriptions().create(request).getId());
  }
}
