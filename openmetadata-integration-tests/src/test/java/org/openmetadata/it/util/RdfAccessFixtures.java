/*
 *  Copyright 2021 Collate
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

package org.openmetadata.it.util;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfProjectionHealth;

/**
 * Users, bots, roles and the readiness marker an RDF integration test needs, each removed by {@link
 * #close()} in reverse order of creation.
 *
 * <p>The Data Consumer policy may ship an {@code ExecuteSparqlQuery} rule, which makes every user
 * "granted". {@link #withoutDefaultSparqlGrant} takes it out for the duration of a body, and does
 * nothing when the rule is not seeded, so a test written against it passes either way.
 */
public final class RdfAccessFixtures implements AutoCloseable {
  private static final String STATUS = AppExtension.ExtensionType.STATUS.toString();
  public static final String RDF_INDEX_APP = "RdfIndexApp";
  private static final String TEST_EMAIL_DOMAIN = "@test.openmetadata.org";
  private static final String DATA_CONSUMER_POLICY = "DataConsumerPolicy";
  private static final String DATA_CONSUMER_GRANT_RULE =
      "DataConsumerPolicy-ExecuteSparqlQuery-Rule";
  private static final long TOKEN_TTL_SECONDS = 3600;

  private final String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
  private final String prefix;
  private final OpenMetadataClient admin = SdkClients.adminClient();
  private final Deque<Runnable> cleanup = new ArrayDeque<>();
  private final List<String> principals = new ArrayList<>();

  public RdfAccessFixtures(final String prefix) {
    this.prefix = prefix;
  }

  /** Unique per instance, for names and IRIs that must not collide across runs. */
  public String suffix() {
    return suffix;
  }

  private static String emailOf(final String userName) {
    return userName + TEST_EMAIL_DOMAIN;
  }

  public Role allowRole(final MetadataOperation operation, final String resource) {
    return role("allow" + operation.value(), operation, resource, Rule.Effect.ALLOW);
  }

  public Role denyRole(final MetadataOperation operation, final String resource) {
    return role("deny" + operation.value(), operation, resource, Rule.Effect.DENY);
  }

  public String userToken(final String name, final List<UUID> roleIds) {
    final String userName = (prefix + name + suffix).toLowerCase(Locale.ROOT);
    final User user =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(userName)
                    .withEmail(emailOf(userName))
                    .withRoles(roleIds));
    cleanup.push(() -> admin.users().delete(user.getId()));
    principals.add(userName);
    final String email = emailOf(userName);
    return JwtAuthProvider.tokenFor(email, email, new String[] {}, TOKEN_TTL_SECONDS);
  }

  /** A bot authorized on its own policies only; MCP has no impersonation header. */
  public String botToken(final String name, final List<UUID> roleIds) {
    final String botUserName = prefix + name + suffix;
    final User botUser =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(botUserName)
                    .withEmail(botUserName + "@test.com")
                    .withIsBot(true)
                    .withRoles(roleIds)
                    .withAuthenticationMechanism(
                        new AuthenticationMechanism()
                            .withAuthType(AuthenticationMechanism.AuthType.JWT)
                            .withConfig(
                                new JWTAuthMechanism()
                                    .withJWTTokenExpiry(JWTTokenExpiry.Unlimited))));
    cleanup.push(() -> admin.users().delete(botUser.getId()));
    principals.add(botUser.getName());
    final Bot bot =
        admin
            .bots()
            .create(new CreateBot().withName(botUserName + "_bot").withBotUser(botUser.getName()));
    cleanup.push(() -> admin.bots().delete(bot.getId()));
    return admin.users().generateToken(botUser.getId(), JWTTokenExpiry.Seven).getJWTToken();
  }

  /**
   * The projection state resolver reads the latest {@code RdfIndexApp} run, so a fresh success row
   * makes the shared projection read as ready regardless of what earlier classes left behind.
   */
  public void markProjectionReady() {
    final UUID appId = UUID.randomUUID();
    final long now = System.currentTimeMillis();
    final AppRunRecord run =
        new AppRunRecord()
            .withAppId(appId)
            .withAppName(RDF_INDEX_APP)
            .withStatus(AppRunRecord.Status.SUCCESS)
            .withTimestamp(now)
            .withStartTime(now)
            .withExtension(STATUS);
    Entity.getCollectionDAO().appExtensionTimeSeriesDao().insert(JsonUtils.pojoToJson(run), STATUS);
    cleanup.push(
        () ->
            Entity.getCollectionDAO().appExtensionTimeSeriesDao().delete(appId.toString(), STATUS));
    RdfProjectionHealth.markReady();
  }

  /** The test class must be {@code @Isolated}: the policy is shared and edited while {@code body} runs. */
  public void withoutDefaultSparqlGrant(final ThrowingRunnable body) throws Exception {
    final Optional<Rule> removed = removeDefaultGrant();
    try {
      body.run();
    } finally {
      removed.ifPresent(this::restoreDefaultGrant);
    }
  }

  @Override
  public void close() {
    while (!cleanup.isEmpty()) {
      cleanup.pop().run();
    }
  }

  private Role role(
      final String name,
      final MetadataOperation operation,
      final String resource,
      final Rule.Effect effect) {
    final Rule rule =
        new Rule()
            .withName(prefix + effect.value())
            .withOperations(List.of(operation))
            .withResources(List.of(resource))
            .withEffect(effect);
    final Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(prefix + name + "Policy" + suffix)
                    .withRules(List.of(rule)));
    cleanup.push(() -> admin.policies().delete(policy.getId()));
    final Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(prefix + name + "Role" + suffix)
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    cleanup.push(() -> admin.roles().delete(role.getId()));
    return role;
  }

  private Optional<Rule> removeDefaultGrant() {
    final Policy policy = admin.policies().getByName(DATA_CONSUMER_POLICY, "rules");
    final Optional<Rule> grant =
        policy.getRules().stream()
            .filter(rule -> DATA_CONSUMER_GRANT_RULE.equals(rule.getName()))
            .findFirst();
    grant.ifPresent(
        rule -> {
          policy.getRules().remove(rule);
          admin.policies().update(policy.getId(), policy);
          refreshPrincipalPermissions();
        });
    return grant;
  }

  private void restoreDefaultGrant(final Rule grant) {
    final Policy current = admin.policies().getByName(DATA_CONSUMER_POLICY, "rules");
    current.getRules().add(grant);
    admin.policies().update(current.getId(), current);
    refreshPrincipalPermissions();
  }

  /**
   * Reads each created principal's effective permissions straight after a policy edit. A principal
   * authorized before the edit can keep the removed rule in its per-user policy cache
   * ({@code SubjectCache}) when its first request after the edit arrives via /mcp; this read forces
   * a fresh evaluation. A test-side workaround, not a statement about the product; see #34826.
   */
  private void refreshPrincipalPermissions() {
    for (final String principal : principals) {
      admin
          .getHttpClient()
          .executeForString(HttpMethod.GET, "/v1/permissions/rdf?user=" + principal, null);
      admin
          .getHttpClient()
          .executeForString(HttpMethod.GET, "/v1/permissions/debug/user/" + principal, null);
    }
  }

  @FunctionalInterface
  public interface ThrowingRunnable {
    void run() throws Exception;
  }
}
