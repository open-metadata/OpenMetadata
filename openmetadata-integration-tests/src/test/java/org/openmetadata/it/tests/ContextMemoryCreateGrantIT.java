package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * Data Consumer's default grant to create context memories, over real HTTP and the seeded policies
 * (ADR:2026-10-09-data-consumers-create-context-memories). Every user here has no role of their own,
 * so whatever they may do comes from the Organization team's Data Consumer role.
 *
 * <p>Isolated and single threaded: one test removes the rule from the seeded {@code
 * DataConsumerPolicy}, and no other test may observe the policy while it is edited.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class ContextMemoryCreateGrantIT {
  private static final String DATA_CONSUMER_POLICY = "DataConsumerPolicy";
  private static final String GRANT_RULE = "DataConsumerPolicy-CreateContextMemory-Rule";

  @Test
  void aUserWithNoRoleOfTheirOwnCreatesMemoriesAndOwnsThem(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    User author = createUser(ns, null);
    ContextMemoryService memories = memoriesAs(author);

    ContextMemory posted = memories.create(anchoredMemory(ns, "posted", anchor));
    ContextMemory put = memories.put(anchoredMemory(ns, "put", anchor));
    ContextMemory edited =
        memories.patch(posted.getId(), replace("/answer", "orders.amount_eur, in euros."));

    assertTrue(mayCaptureMemories(author));
    assertEquals(Permission.Access.ALLOW, createAccess(author));
    assertEquals(List.of(author.getId()), ownerIds(posted));
    assertEquals(List.of(author.getId()), ownerIds(put));
    assertEquals("orders.amount_eur, in euros.", edited.getAnswer());
  }

  @Test
  void anotherUserStillCannotEditTheMemory(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    ContextMemory memory =
        memoriesAs(createUser(ns, null)).create(anchoredMemory(ns, "someone-elses", anchor));
    ContextMemoryService other = memoriesAs(createUser(ns, null));

    assertEquals(memory.getId(), other.get(memory.getId().toString()).getId());
    assertThrows(
        ForbiddenException.class,
        () -> other.patch(memory.getId(), replace("/answer", "a different answer")));
  }

  @Test
  void aDenyRuleOverridesTheGrant(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    User denied = createUser(ns, denyMemoryCreation(ns));

    assertThrows(
        ForbiddenException.class,
        () -> memoriesAs(denied).create(anchoredMemory(ns, "denied", anchor)));
    assertFalse(mayCaptureMemories(denied));
    assertEquals(Permission.Access.DENY, createAccess(denied));
  }

  @Test
  void removingTheRuleMakesCreationAdminOnly(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    User author = createUser(ns, null);
    Rule grant = removeGrant();
    try {
      assertThrows(
          ForbiddenException.class,
          () -> memoriesAs(author).create(anchoredMemory(ns, "withdrawn", anchor)));
      assertFalse(mayCaptureMemories(author));
      adminMemories().create(anchoredMemory(ns, "admin-still", anchor));
    } finally {
      restoreGrant(grant);
    }

    assertTrue(mayCaptureMemories(author));
    memoriesAs(author).create(anchoredMemory(ns, "restored", anchor));
  }

  /** The memory {@code upsertMemory} writes for an asset: entity-scoped, shown to its readers. */
  private static CreateContextMemory anchoredMemory(TestNamespace ns, String name, Table anchor) {
    return new CreateContextMemory()
        .withName(ns.prefix(name))
        .withMemoryScope(ContextMemoryScope.ENTITY_SCOPED)
        .withEntityStatus(ContextMemoryStatus.APPROVED)
        .withQuestion("Which column holds the order total?")
        .withAnswer("orders.amount_usd, in US dollars.")
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY))
        .withPrimaryEntity(new EntityReference().withId(anchor.getId()).withType(Entity.TABLE));
  }

  /**
   * The check Collate's MemoryCaptureGate makes before a turn: Create on the bare resource. A rule
   * that needs a condition, such as the Organization owner rule, cannot hold here, because a memory
   * that does not exist yet has no owner.
   */
  private static boolean mayCaptureMemories(User user) {
    boolean allowed = true;
    try {
      DefaultAuthorizer.authorizeUser(
          user.getName(),
          new OperationContext(Entity.CONTEXT_MEMORY, MetadataOperation.CREATE),
          new ResourceContext<>(Entity.CONTEXT_MEMORY));
    } catch (AuthorizationException e) {
      allowed = false;
    }
    return allowed;
  }

  /**
   * What the permissions API, and so the Context Center's create action, reports for Create. It
   * shows the owner rule as conditional, so only the unconditional answers are asserted on it.
   */
  private static Permission.Access createAccess(User user) {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/permissions/" + Entity.CONTEXT_MEMORY + "?user=" + user.getName(),
                null);
    return JsonUtils.readValue(response, ResourcePermission.class).getPermissions().stream()
        .filter(permission -> permission.getOperation() == MetadataOperation.CREATE)
        .findFirst()
        .orElseThrow()
        .getAccess();
  }

  private static Rule removeGrant() {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy policy = admin.policies().getByName(DATA_CONSUMER_POLICY, "rules");
    Rule grant =
        policy.getRules().stream()
            .filter(rule -> GRANT_RULE.equals(rule.getName()))
            .findFirst()
            .orElseThrow(() -> new AssertionError(GRANT_RULE + " must be seeded"));
    policy.getRules().remove(grant);
    admin.policies().update(policy.getId(), policy);
    return grant;
  }

  private static void restoreGrant(Rule grant) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy current = admin.policies().getByName(DATA_CONSUMER_POLICY, "rules");
    current.getRules().add(grant);
    admin.policies().update(current.getId(), current);
  }

  private static Role denyMemoryCreation(TestNamespace ns) {
    Rule deny =
        new Rule()
            .withName("DenyMemoryCreate")
            .withEffect(Rule.Effect.DENY)
            .withOperations(List.of(MetadataOperation.CREATE))
            .withResources(List.of(Entity.CONTEXT_MEMORY));
    Policy policy =
        SdkClients.adminClient()
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.prefix("deny-memory-create"))
                    .withRules(List.of(deny)));
    return SdkClients.adminClient()
        .roles()
        .create(
            new CreateRole()
                .withName(ns.prefix("no-memories"))
                .withPolicies(List.of(policy.getFullyQualifiedName())));
  }

  private static User createUser(TestNamespace ns, Role role) {
    String name = "cmgrant_" + UUID.randomUUID().toString().substring(0, 8);
    CreateUser request = new CreateUser().withName(name).withEmail(name + "@test.openmetadata.org");
    if (role != null) {
      request.withRoles(List.of(role.getId()));
    }
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(request));
  }

  private static ContextMemoryService memoriesAs(User user) {
    OpenMetadataClient client =
        SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
    return new ContextMemoryService(client.getHttpClient());
  }

  private static ContextMemoryService adminMemories() {
    return new ContextMemoryService(SdkClients.adminClient().getHttpClient());
  }

  private static List<UUID> ownerIds(ContextMemory memory) {
    return adminMemories().get(memory.getId().toString(), Entity.FIELD_OWNERS).getOwners().stream()
        .map(EntityReference::getId)
        .toList();
  }

  private static JsonNode replace(String path, String value) {
    return JsonUtils.readTree(
        "[{\"op\":\"replace\",\"path\":\"" + path + "\",\"value\":\"" + value + "\"}]");
  }
}
