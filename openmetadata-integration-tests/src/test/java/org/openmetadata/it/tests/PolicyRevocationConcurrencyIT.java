package org.openmetadata.it.tests;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.tests.mcp.McpTestBase;
import org.openmetadata.it.tests.mcp.McpTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;
import org.openmetadata.service.util.PerRequestContextCleaner;

/**
 * Authorization loads that are already running when a policy edit commits must not outlive it.
 *
 * <p>The readers go through {@link SubjectCache}, the production path every transport shares, while
 * an administrator removes a rule over HTTP. A reader that <em>starts</em> after the update response
 * has returned must never be handed the removed rule, however its load interleaved with the
 * invalidation. Every wait is bounded and nothing sleeps.
 *
 * <p>The fixture policy belongs to this test, so it does not need the isolation the seeded Data
 * Consumer policy does.
 */
@ExtendWith(TestNamespaceExtension.class)
public class PolicyRevocationConcurrencyIT extends McpTestBase {
  private static final String KEPT_RULE = "keptRule";
  private static final String REVOCABLE_RULE = "revocableRule";
  private static final String DENY_RULE = "denyViewRule";
  private static final String CREATE_RULE = "allowGlossaryCreate";
  private static final String RULES_FIELD = "rules";
  private static final String MCP_BOT = "McpApplicationBot";
  private static final String GLOSSARY_DESCRIPTION = "A glossary created through MCP";
  private static final String PATCHED_DESCRIPTION = "Patched through MCP";
  private static final int ROUNDS = 5;
  private static final int READERS = 8;
  private static final int READS_AFTER_UPDATE = 150;
  private static final Duration WAIT = Duration.ofSeconds(60);

  @BeforeAll
  static void setUp() throws Exception {
    initAuth();
  }

  @Test
  void readersStartedAfterTheUpdateNeverSeeTheRemovedRuleForADirectRole(TestNamespace ns)
      throws Exception {
    Fixture fixture = fixtureWithDirectRole(ns);

    assertRevocationOutlastsRacingReaders(fixture);
  }

  @Test
  void readersStartedAfterTheUpdateNeverSeeTheRemovedRuleForATeamInheritedRole(TestNamespace ns)
      throws Exception {
    Fixture fixture = fixtureWithTeamDefaultRole(ns);

    assertRevocationOutlastsRacingReaders(fixture);
  }

  @Test
  void anotherMcpToolSeesTheRemovalOfADenyRuleOnItsFirstRequest(TestNamespace ns) throws Exception {
    Table table = createServiceDatabaseSchemaTable("rev" + ns.shortPrefix());
    ns.trackRoot(Entity.DATABASE_SERVICE, table.getService().getId());
    Policy policy = createPolicy(ns, List.of(denyViewRule(), allowGlossaryViewRule()));
    String userName = createUser(ns, List.of(createRole(ns, policy).getId()), List.of());
    String token = "Bearer " + tokenFor(userName);
    assertThat(isEntityDetailsDenied(token, table)).isTrue();

    removeRule(policy, DENY_RULE);

    assertThat(isEntityDetailsDenied(token, table)).isFalse();
  }

  @Test
  void removingADirectAllowRuleByPutDeniesTheNextMcpAndRestCreates(TestNamespace ns)
      throws Exception {
    assertNextCreatesDeniedAfterRemoval(ns, false);
  }

  @Test
  void removingAnInheritedAllowRuleByPatchDeniesTheNextMcpAndRestCreates(TestNamespace ns)
      throws Exception {
    assertNextCreatesDeniedAfterRemoval(ns, true);
  }

  @Test
  void createdEntityPersistsTheMcpBotAsImpersonator(TestNamespace ns) throws Exception {
    Glossary glossary = createGlossaryThroughMcp(ns, authToken, ns.prefix("auditCreate"));

    assertThat(glossary.getUpdatedBy()).isEqualTo("admin");
    assertThat(glossary.getImpersonatedBy()).isEqualTo(MCP_BOT);
  }

  @Test
  void patchedEntityPersistsTheMcpBotAsImpersonator(TestNamespace ns) throws Exception {
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            SdkClients.adminClient()
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.prefix("auditPatch"))
                        .withDescription(GLOSSARY_DESCRIPTION)));
    assertThat(glossary.getImpersonatedBy()).isNull();

    JsonNode result =
        executeMcpRequest(
                McpTestUtils.createToolCallRequest(
                    "patch_entity",
                    Map.of(
                        "entityType",
                        Entity.GLOSSARY,
                        "fqn",
                        glossary.getFullyQualifiedName(),
                        "patch",
                        "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\""
                            + PATCHED_DESCRIPTION
                            + "\"}]")))
            .path("result");
    assertThat(result.path("isError").asBoolean()).as("%s", result).isFalse();
    Glossary patched = SdkClients.adminClient().glossaries().get(glossary.getId().toString());
    assertThat(patched.getDescription()).isEqualTo(PATCHED_DESCRIPTION);
    assertThat(patched.getUpdatedBy()).isEqualTo("admin");
    assertThat(patched.getImpersonatedBy()).isEqualTo(MCP_BOT);
  }

  private void assertNextCreatesDeniedAfterRemoval(TestNamespace ns, boolean inherited)
      throws Exception {
    Policy policy = createPolicy(ns, List.of(allowGlossaryViewRule(), allowGlossaryCreateRule()));
    Role role = createRole(ns, policy);
    String userName =
        inherited
            ? createUserWithTeamRole(ns, role)
            : createUser(ns, List.of(role.getId()), List.of());
    String token = "Bearer " + tokenFor(userName);
    createGlossaryThroughMcp(ns, token, ns.prefix("warmCreate"));

    removeCreateGrant(policy, inherited);

    assertNextMcpAndRestCreatesDenied(ns, token);
  }

  private void assertNextMcpAndRestCreatesDenied(TestNamespace ns, String token) throws Exception {
    String mcpName = ns.prefix("deniedMcpCreate");
    JsonNode denied = glossaryCreateResult(token, mcpName);
    trackUnexpectedCreate(ns, denied.path("structuredContent"));
    assertThat(denied.path("isError").asBoolean()).as("%s", denied).isTrue();
    assertThat(denied.path("structuredContent").path("statusCode").asInt()).isEqualTo(403);
    String restName = ns.prefix("deniedRestCreate");
    HttpResponse<String> rest =
        postResponse(
            "glossaries",
            new CreateGlossary().withName(restName).withDescription(GLOSSARY_DESCRIPTION),
            token);
    trackUnexpectedCreate(ns, OBJECT_MAPPER.readTree(rest.body()));
    assertThat(rest.statusCode()).as("%s", rest.body()).isEqualTo(403);
    assertGlossaryAbsent(mcpName);
    assertGlossaryAbsent(restName);
  }

  private static void trackUnexpectedCreate(TestNamespace ns, JsonNode payload) {
    JsonNode id = payload.path("id");
    if (id.isTextual()) {
      ns.trackRoot(Entity.GLOSSARY, UUID.fromString(id.asText()));
    }
  }

  private Glossary createGlossaryThroughMcp(TestNamespace ns, String token, String name)
      throws Exception {
    JsonNode result = glossaryCreateResult(token, name);
    assertThat(result.path("isError").asBoolean()).as("%s", result).isFalse();
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().getByName(name));
  }

  private JsonNode glossaryCreateResult(String token, String name) throws Exception {
    return executeMcpRequest(
            McpTestUtils.createToolCallRequest(
                "create_entity",
                Map.of(
                    "entityType",
                    Entity.GLOSSARY,
                    "name",
                    name,
                    "description",
                    GLOSSARY_DESCRIPTION)),
            token)
        .path("result");
  }

  private static void assertGlossaryAbsent(String name) {
    assertThatThrownBy(() -> SdkClients.adminClient().glossaries().getByName(name))
        .isInstanceOf(ApiException.class)
        .satisfies(failure -> assertThat(((ApiException) failure).getStatusCode()).isEqualTo(404));
  }

  private static void removeCreateGrant(Policy policy, boolean patchRule) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy current = admin.policies().get(policy.getId().toString(), RULES_FIELD);
    if (patchRule) {
      int index =
          IntStream.range(0, current.getRules().size())
              .filter(position -> CREATE_RULE.equals(current.getRules().get(position).getName()))
              .findFirst()
              .orElseThrow();
      patch(
          "policies/" + policy.getId(), "[{\"op\":\"remove\",\"path\":\"/rules/" + index + "\"}]");
    } else {
      current.getRules().removeIf(rule -> CREATE_RULE.equals(rule.getName()));
      admin
          .getHttpClient()
          .execute(
              HttpMethod.PUT,
              "/v1/policies",
              new CreatePolicy()
                  .withName(current.getName())
                  .withEnabled(current.getEnabled())
                  .withRules(current.getRules()),
              Policy.class);
    }
    assertThat(
            SdkClients.adminClient()
                .policies()
                .get(policy.getId().toString(), RULES_FIELD)
                .getRules())
        .noneMatch(rule -> CREATE_RULE.equals(rule.getName()));
  }

  private static Rule allowGlossaryCreateRule() {
    return new Rule()
        .withName(CREATE_RULE)
        .withOperations(List.of(MetadataOperation.CREATE))
        .withResources(List.of(Entity.GLOSSARY))
        .withEffect(Rule.Effect.ALLOW);
  }

  private void assertRevocationOutlastsRacingReaders(Fixture fixture) throws Exception {
    ExecutorService readers = Executors.newFixedThreadPool(READERS);
    try {
      for (int round = 0; round < ROUNDS; round++) {
        assertThat(grantsRevocableRule(fixture)).as("warm cache sees the grant").isTrue();
        int staleReads = raceReadersAgainstRemoval(fixture, readers);
        assertThat(staleReads)
            .as(
                "reads that began after the update returned but saw the removed rule, round %d",
                round)
            .isZero();
        addRule(fixture.policy(), fixture.revocableRule());
        assertThat(grantsRevocableRule(fixture)).as("the restored rule is seen").isTrue();
      }
    } finally {
      readers.shutdownNow();
    }
  }

  private int raceReadersAgainstRemoval(Fixture fixture, ExecutorService pool) throws Exception {
    AtomicBoolean updateReturned = new AtomicBoolean();
    AtomicInteger staleReads = new AtomicInteger();
    CountDownLatch go = new CountDownLatch(1);
    List<CompletableFuture<Void>> readers = new ArrayList<>();
    for (int reader = 0; reader < READERS; reader++) {
      readers.add(
          CompletableFuture.runAsync(
              () -> readUntilEnoughReadsFollowTheUpdate(fixture, go, updateReturned, staleReads),
              pool));
    }

    go.countDown();
    removeRule(fixture.policy(), REVOCABLE_RULE);
    updateReturned.set(true);

    awaitAll(readers);
    return staleReads.get();
  }

  private void readUntilEnoughReadsFollowTheUpdate(
      Fixture fixture, CountDownLatch go, AtomicBoolean updateReturned, AtomicInteger staleReads) {
    awaitLatch(go);
    int readsAfterUpdate = 0;
    long deadline = System.nanoTime() + WAIT.toNanos();
    while (readsAfterUpdate < READS_AFTER_UPDATE && System.nanoTime() < deadline) {
      // A request boundary: the entity cache is thread-local, so a reused reader thread would
      // otherwise answer every later load from the rules it cached before the edit.
      PerRequestContextCleaner.clear();
      boolean beganAfterUpdate = updateReturned.get();
      boolean sawRemovedRule = grantsRevocableRule(fixture);
      if (beganAfterUpdate) {
        readsAfterUpdate++;
        if (sawRemovedRule) {
          staleReads.incrementAndGet();
        }
      }
      Thread.onSpinWait();
    }
    assertThat(readsAfterUpdate)
        .as("every reader must exercise post-update decisions")
        .isEqualTo(READS_AFTER_UPDATE);
  }

  private static boolean grantsRevocableRule(Fixture fixture) {
    return SubjectCache.getPolicies(fixture.userName()).stream()
        .filter(context -> fixture.policy().getName().equals(context.getPolicyName()))
        .map(PolicyContext::getRules)
        .flatMap(List::stream)
        .anyMatch(rule -> REVOCABLE_RULE.equals(rule.getName()));
  }

  private boolean isEntityDetailsDenied(String token, Table table) throws Exception {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("entityType", Entity.TABLE);
    arguments.put("fqn", table.getFullyQualifiedName());
    JsonNode result =
        executeMcpRequest(
                McpTestUtils.createToolCallRequest("get_entity_details", arguments), token)
            .path("result");
    if (result.path("isError").asBoolean(false)) {
      assertThat(result.path("structuredContent").path("statusCode").asInt()).isEqualTo(403);
      return true;
    }
    return false;
  }

  private static Fixture fixtureWithDirectRole(TestNamespace ns) {
    Policy policy = createPolicy(ns, List.of(keptRule(), revocableRule()));
    Role role = createRole(ns, policy);
    String userName = createUser(ns, List.of(role.getId()), List.of());
    return new Fixture(policy, revocableRule(), userName);
  }

  private static Fixture fixtureWithTeamDefaultRole(TestNamespace ns) {
    Policy policy = createPolicy(ns, List.of(keptRule(), revocableRule()));
    Role role = createRole(ns, policy);
    String userName = createUserWithTeamRole(ns, role);
    return new Fixture(policy, revocableRule(), userName);
  }

  private static String createUserWithTeamRole(TestNamespace ns, Role role) {
    UUID teamId =
        ns.trackRoot(
                Entity.TEAM,
                SdkClients.adminClient()
                    .teams()
                    .create(
                        new CreateTeam()
                            .withName(ns.prefix("revTeam"))
                            .withTeamType(TeamType.GROUP)
                            .withDefaultRoles(List.of(role.getId()))))
            .getId();
    return createUser(ns, List.of(), List.of(teamId));
  }

  private static Policy createPolicy(TestNamespace ns, List<Rule> rules) {
    return ns.trackRoot(
        Entity.POLICY,
        SdkClients.adminClient()
            .policies()
            .create(new CreatePolicy().withName(ns.prefix("revPolicy")).withRules(rules)));
  }

  private static Role createRole(TestNamespace ns, Policy policy) {
    return ns.trackRoot(
        Entity.ROLE,
        SdkClients.adminClient()
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.prefix("revRole"))
                    .withPolicies(List.of(policy.getFullyQualifiedName()))));
  }

  private static String createUser(TestNamespace ns, List<UUID> roles, List<UUID> teams) {
    String name = "revuser" + ns.shortPrefix();
    User user =
        ns.trackRoot(
            Entity.USER,
            SdkClients.adminClient()
                .users()
                .create(
                    new CreateUser()
                        .withName(name)
                        .withEmail(name + "@test.openmetadata.org")
                        .withRoles(roles)
                        .withTeams(teams)));
    return user.getName();
  }

  private static void removeRule(Policy policy, String ruleName) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy current = admin.policies().get(policy.getId().toString(), RULES_FIELD);
    current.getRules().removeIf(rule -> ruleName.equals(rule.getName()));
    admin.policies().update(current.getId(), current);
  }

  private static void addRule(Policy policy, Rule rule) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy current = admin.policies().get(policy.getId().toString(), RULES_FIELD);
    current.getRules().add(rule);
    admin.policies().update(current.getId(), current);
  }

  private static Rule keptRule() {
    return new Rule()
        .withName(KEPT_RULE)
        .withOperations(List.of(MetadataOperation.VIEW_BASIC))
        .withResources(List.of(Entity.TABLE))
        .withEffect(Rule.Effect.ALLOW);
  }

  private static Rule revocableRule() {
    return new Rule()
        .withName(REVOCABLE_RULE)
        .withOperations(List.of(MetadataOperation.EDIT_DESCRIPTION))
        .withResources(List.of(Entity.TABLE))
        .withEffect(Rule.Effect.ALLOW);
  }

  private static Rule denyViewRule() {
    return new Rule()
        .withName(DENY_RULE)
        .withOperations(List.of(MetadataOperation.VIEW_BASIC, MetadataOperation.VIEW_ALL))
        .withResources(List.of(Entity.TABLE))
        .withEffect(Rule.Effect.DENY);
  }

  private static Rule allowGlossaryViewRule() {
    return new Rule()
        .withName("allowGlossaryView")
        .withOperations(List.of(MetadataOperation.VIEW_BASIC))
        .withResources(List.of(Entity.GLOSSARY))
        .withEffect(Rule.Effect.ALLOW);
  }

  private static void awaitLatch(CountDownLatch latch) {
    try {
      if (!latch.await(WAIT.toSeconds(), TimeUnit.SECONDS)) {
        throw new IllegalStateException("start signal never arrived");
      }
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(interrupted);
    }
  }

  private static void awaitAll(List<CompletableFuture<Void>> futures)
      throws InterruptedException, ExecutionException, TimeoutException {
    CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new))
        .get(WAIT.toSeconds(), TimeUnit.SECONDS);
  }

  private record Fixture(Policy policy, Rule revocableRule, String userName) {}
}
