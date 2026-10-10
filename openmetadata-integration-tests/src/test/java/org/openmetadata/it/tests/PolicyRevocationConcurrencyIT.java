package org.openmetadata.it.tests;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
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
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.tests.mcp.McpTestBase;
import org.openmetadata.it.tests.mcp.McpTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
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
  private static final int ROUNDS = 5;
  private static final int READERS = 8;
  private static final int READS_AFTER_UPDATE = 150;
  private static final Duration WAIT = Duration.ofSeconds(60);
  private static final long TOKEN_TTL_SECONDS = 3600;

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
    Policy policy = createPolicy(ns, List.of(denyViewRule(), allowGlossaryViewRule()));
    String userName = createUser(ns, List.of(createRole(ns, policy).getId()), List.of());
    String token = "Bearer " + tokenFor(userName);
    assertThat(isEntityDetailsDenied(token, table)).isTrue();

    removeRule(policy, DENY_RULE);

    assertThat(isEntityDetailsDenied(token, table)).isFalse();
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
    return result.path("isError").asBoolean(false) && result.toString().contains("Authorization");
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
    String userName = createUser(ns, List.of(), List.of(teamId));
    return new Fixture(policy, revocableRule(), userName);
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
    Policy current = admin.policies().get(policy.getId().toString(), "rules");
    current.getRules().removeIf(rule -> ruleName.equals(rule.getName()));
    admin.policies().update(current.getId(), current);
  }

  private static void addRule(Policy policy, Rule rule) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy current = admin.policies().get(policy.getId().toString(), "rules");
    current.getRules().add(rule);
    admin.policies().update(current.getId(), current);
  }

  private static Rule keptRule() {
    return new Rule()
        .withName(KEPT_RULE)
        .withOperations(List.of(MetadataOperation.VIEW_BASIC))
        .withResources(List.of("table"))
        .withEffect(Rule.Effect.ALLOW);
  }

  private static Rule revocableRule() {
    return new Rule()
        .withName(REVOCABLE_RULE)
        .withOperations(List.of(MetadataOperation.EDIT_DESCRIPTION))
        .withResources(List.of("table"))
        .withEffect(Rule.Effect.ALLOW);
  }

  private static Rule denyViewRule() {
    return new Rule()
        .withName(DENY_RULE)
        .withOperations(List.of(MetadataOperation.VIEW_BASIC, MetadataOperation.VIEW_ALL))
        .withResources(List.of("table"))
        .withEffect(Rule.Effect.DENY);
  }

  private static Rule allowGlossaryViewRule() {
    return new Rule()
        .withName("allowGlossaryView")
        .withOperations(List.of(MetadataOperation.VIEW_BASIC))
        .withResources(List.of("glossary"))
        .withEffect(Rule.Effect.ALLOW);
  }

  private static String tokenFor(String userName) {
    String email = userName + "@test.openmetadata.org";
    return JwtAuthProvider.tokenFor(email, email, new String[] {}, TOKEN_TTL_SECONDS);
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
