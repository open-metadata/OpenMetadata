package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.service.Entity;

/**
 * A PATCH is authorized at every location it touches: the {@code from} of a move or copy as well
 * as its {@code path}, and a field name only where the entity's type declares that field. Every
 * user inherits DataConsumer, which grants EditDescription on all resources, so moves into
 * {@code /description} are the probe here.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class PatchAuthorizationIT {

  @Test
  void movingARuleConditionOutNeedsEditAll(TestNamespace ns) {
    Policy policy =
        SdkClients.adminClient()
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.prefix("conditionalPolicy"))
                    .withDescription("Policy whose rule has a condition")
                    .withOwners(adminOwner())
                    .withRules(
                        List.of(
                            new Rule()
                                .withName("ownersOnly")
                                .withResources(List.of(Entity.ALL_RESOURCES))
                                .withOperations(List.of(MetadataOperation.EDIT_DISPLAY_NAME))
                                .withEffect(Rule.Effect.ALLOW)
                                .withCondition("isOwner()"))));
    User user = createUser(ns, "conditionmover", null);

    assertThrows(
        ForbiddenException.class,
        () ->
            clientFor(user)
                .policies()
                .patch(policy.getId(), move("/rules/0/condition", "/description")));

    assertEquals(
        "isOwner()",
        SdkClients.adminClient()
            .policies()
            .get(policy.getId().toString())
            .getRules()
            .get(0)
            .getCondition());
  }

  @Test
  void movingARoleOutOfTheirOwnProfileNeedsAnAdmin(TestNamespace ns) {
    Role role =
        SdkClients.adminClient()
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.prefix("assignedRole"))
                    .withDescription("Role an admin assigned")
                    .withPolicies(List.of("DataConsumerPolicy")));
    User user = createUser(ns, "rolemover", role);

    assertThrows(
        ForbiddenException.class,
        () -> clientFor(user).users().patch(user.getId(), move("/roles/0", "/description")));

    assertEquals(
        List.of(role.getId()),
        SdkClients.adminClient().users().get(user.getId().toString(), "roles").getRoles().stream()
            .map(EntityReference::getId)
            .toList());
  }

  @Test
  void movingIsJoinableOutNeedsEditAll(TestNamespace ns) {
    Team team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("closedTeam"))
                    .withDescription("Team that is not joinable")
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withIsJoinable(false));
    User user = createUser(ns, "teamopener", null);

    assertThrows(
        ForbiddenException.class,
        () -> clientFor(user).teams().patch(team.getId(), move("/isJoinable", "/description")));

    assertEquals(
        Boolean.FALSE,
        SdkClients.adminClient().teams().get(team.getId().toString()).getIsJoinable());
  }

  @Test
  void alertHeaderKeysNamedLikeFieldsNeedEditAll(TestNamespace ns) {
    EventSubscription alert =
        SdkClients.adminClient()
            .eventSubscriptions()
            .create(
                new CreateEventSubscription()
                    .withName(ns.prefix("headerAlert"))
                    .withDescription("Alert with webhook headers")
                    .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
                    .withResources(List.of("all"))
                    .withEnabled(false)
                    .withOwners(adminOwner())
                    .withDestinations(
                        List.of(
                            new SubscriptionDestination()
                                .withId(UUID.randomUUID())
                                .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
                                .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
                                .withConfig(
                                    new Webhook()
                                        .withEndpoint(
                                            URI.create(
                                                "http://localhost:8585/api/v1/test/webhook/test"))
                                        .withHeaders(Map.of("x-team", "data"))))));
    OpenMetadataClient asUser = clientFor(createUser(ns, "headereditor", null));

    for (String key : List.of("description", "tags")) {
      JsonNode addHeader =
          JsonUtils.valueToTree(
              List.of(
                  Map.of(
                      "op",
                      "add",
                      "path",
                      "/destinations/0/config/headers/" + key,
                      "value",
                      "edited")));
      assertThrows(
          ForbiddenException.class,
          () -> asUser.eventSubscriptions().patch(alert.getId(), addHeader),
          key);
    }
  }

  @Test
  void aTestOperationBesideATagRemovalStillMeetsADenyOnEditTags(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Classification classification =
        ns.trackRoot(
            Entity.CLASSIFICATION,
            admin
                .classifications()
                .create(
                    new CreateClassification()
                        .withName(ns.shortPrefix("guarded"))
                        .withDescription("Classification whose labels owners may not edit")));
    Tag sensitive =
        admin
            .tags()
            .create(
                new CreateTag()
                    .withName("Sensitive")
                    .withClassification(classification.getFullyQualifiedName())
                    .withDescription("Label an owner may not remove"));
    Policy denyTagEdits =
        ns.trackRoot(
            Entity.POLICY,
            admin
                .policies()
                .create(
                    new CreatePolicy()
                        .withName(ns.prefix("denySensitiveTagEdits"))
                        .withDescription("Deny editing the tags of a sensitive asset")
                        .withRules(
                            List.of(
                                new Rule()
                                    .withName("denySensitiveTagEdits")
                                    .withResources(List.of(Entity.ALL_RESOURCES))
                                    .withOperations(List.of(MetadataOperation.EDIT_TAGS))
                                    .withEffect(Rule.Effect.DENY)
                                    .withCondition(
                                        "matchAnyTag('"
                                            + sensitive.getFullyQualifiedName()
                                            + "')")))));
    Role tagGuard =
        ns.trackRoot(
            Entity.ROLE,
            admin
                .roles()
                .create(
                    new CreateRole()
                        .withName(ns.prefix("sensitiveTagGuard"))
                        .withDescription("Role that may not edit sensitive tags")
                        .withPolicies(List.of(denyTagEdits.getFullyQualifiedName()))));
    User owner = createUser(ns, "tagowner", tagGuard);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table table =
        admin
            .tables()
            .create(
                new CreateTable()
                    .withName("guarded")
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withOwners(List.of(owner.getEntityReference()))
                    .withTags(
                        List.of(
                            new TagLabel()
                                .withTagFQN(sensitive.getFullyQualifiedName())
                                .withSource(TagLabel.TagSource.CLASSIFICATION)
                                .withLabelType(TagLabel.LabelType.MANUAL)
                                .withState(TagLabel.State.CONFIRMED)))
                    .withColumns(
                        List.of(new Column().withName("id").withDataType(ColumnDataType.INT))));
    JsonNode testThenRemoveTag =
        JsonUtils.valueToTree(
            List.of(
                Map.of("op", "test", "path", "/name", "value", table.getName()),
                Map.of("op", "remove", "path", "/tags/0")));

    assertThrows(
        ForbiddenException.class,
        () -> clientFor(owner).tables().patch(table.getId(), testThenRemoveTag));

    assertEquals(
        List.of(sensitive.getFullyQualifiedName()),
        admin.tables().get(table.getId().toString(), "tags").getTags().stream()
            .map(TagLabel::getTagFQN)
            .toList());
  }

  private static JsonNode move(String from, String path) {
    return JsonUtils.valueToTree(List.of(Map.of("op", "move", "from", from, "path", path)));
  }

  private static List<EntityReference> adminOwner() {
    return List.of(SdkClients.adminClient().users().getByName("admin").getEntityReference());
  }

  private static User createUser(TestNamespace ns, String suffix, Role role) {
    String name = "pa_" + suffix + "_" + UUID.randomUUID().toString().substring(0, 8);
    CreateUser request = new CreateUser().withName(name).withEmail(name + "@test.openmetadata.org");
    if (role != null) {
      request.withRoles(List.of(role.getId()));
    }
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(request));
  }

  private static OpenMetadataClient clientFor(User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }
}
