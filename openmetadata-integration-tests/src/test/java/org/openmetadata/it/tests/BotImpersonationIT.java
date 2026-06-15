package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for the bot impersonation capability.
 *
 * <p>Covers the grant lifecycle on {@code POST/PUT /v1/bots} (admin-only, creation-time enable,
 * revoke, PUT upserts preserving the grant), the read-only {@code allowImpersonation} field on the
 * user APIs, and end-to-end {@code X-Impersonate-User} requests scoped by the seeded
 * BotImpersonationPolicy (regular users allowed, admins and bots denied by default, wider policies
 * via standard RBAC).
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class BotImpersonationIT {

  private static final String BOT_IMPERSONATION_ROLE = "BotImpersonationRole";
  private static final String BOT_NON_ADMIN_IMPERSONATION_ROLE = "BotNonAdminImpersonationRole";
  private static final String USER_FIELDS = "roles,allowImpersonation";
  private static final String IMPERSONATE_HEADER = "X-Impersonate-User";

  @Test
  void test_createBotWithImpersonation_grantsFlagAndRole(TestNamespace ns) {
    User botUser = createBotUser(ns, "grant");

    Bot bot = createBot(ns.prefix("imp_grant_bot"), botUser, true);
    assertNotNull(bot);

    User refreshed = getBotUser(botUser.getName());
    assertTrue(
        Boolean.TRUE.equals(refreshed.getAllowImpersonation()),
        "Bot user must have allowImpersonation enabled after creation with the grant");
    assertNotNull(refreshed.getRoles(), "Bot user must have roles after the grant");
    assertTrue(
        refreshed.getRoles().stream().anyMatch(r -> BOT_IMPERSONATION_ROLE.equals(r.getName())),
        "Bot user must have BotImpersonationRole attached after the grant");
  }

  @Test
  void test_createBotWithImpersonation_requiresAdmin(TestNamespace ns) {
    User botUser = createBotUser(ns, "nonadmin");

    CreateBot request =
        new CreateBot()
            .withName(ns.prefix("imp_nonadmin_bot"))
            .withDescription("Bot created by non-admin with impersonation")
            .withBotUser(botUser.getName())
            .withAllowImpersonation(true);

    Exception exception =
        assertThrows(
            Exception.class,
            () ->
                SdkClients.user1Client()
                    .getHttpClient()
                    .execute(HttpMethod.POST, "/v1/bots", request, Bot.class),
            "Non-admin must not be able to create a bot with impersonation enabled");
    assertTrue(
        exception.getMessage().contains("admin")
            || exception.getMessage().contains("Authorization"),
        "Error should mention admin or authorization: " + exception.getMessage());
  }

  @Test
  void test_enableImpersonationOnExistingBot_rejected(TestNamespace ns) {
    User botUser = createBotUser(ns, "existing");
    String botName = ns.prefix("imp_existing_bot");
    createBot(botName, botUser, null);

    CreateBot enableRequest =
        new CreateBot()
            .withName(botName)
            .withDescription("Attempt to enable impersonation after creation")
            .withBotUser(botUser.getName())
            .withAllowImpersonation(true);

    Exception exception =
        assertThrows(
            Exception.class,
            () ->
                SdkClients.adminClient()
                    .getHttpClient()
                    .execute(HttpMethod.PUT, "/v1/bots", enableRequest, Bot.class),
            "Enabling impersonation on an existing bot must be rejected");
    assertTrue(
        exception.getMessage().contains("can only be enabled when the bot is created"),
        "Error should state the grant is creation-time only: " + exception.getMessage());

    User refreshed = getBotUser(botUser.getName());
    assertFalse(
        Boolean.TRUE.equals(refreshed.getAllowImpersonation()),
        "Rejected enable attempt must not change the bot user");
  }

  @Test
  void test_putWithoutFlag_preservesGrant(TestNamespace ns) {
    User botUser = createBotUser(ns, "preserve");
    String botName = ns.prefix("imp_preserve_bot");
    createBot(botName, botUser, true);

    CreateBot upsert =
        new CreateBot()
            .withName(botName)
            .withDescription("Updated description without the impersonation field")
            .withBotUser(botUser.getName());
    Bot updated =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.PUT, "/v1/bots", upsert, Bot.class);
    assertNotNull(updated);

    User refreshed = getBotUser(botUser.getName());
    assertTrue(
        Boolean.TRUE.equals(refreshed.getAllowImpersonation()),
        "PUT without allowImpersonation must keep the existing grant");
    assertTrue(
        refreshed.getRoles().stream().anyMatch(r -> BOT_IMPERSONATION_ROLE.equals(r.getName())),
        "PUT without allowImpersonation must keep BotImpersonationRole");
  }

  @Test
  void test_revokeImpersonation(TestNamespace ns) {
    User botUser = createBotUser(ns, "revoke");
    String botName = ns.prefix("imp_revoke_bot");
    createBot(botName, botUser, true);

    CreateBot revoke =
        new CreateBot()
            .withName(botName)
            .withDescription("Revoking impersonation")
            .withBotUser(botUser.getName())
            .withAllowImpersonation(false);
    Bot updated =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.PUT, "/v1/bots", revoke, Bot.class);
    assertNotNull(updated);

    User refreshed = getBotUser(botUser.getName());
    assertFalse(
        Boolean.TRUE.equals(refreshed.getAllowImpersonation()),
        "Revoking must disable allowImpersonation on the bot user");
    assertTrue(
        refreshed.getRoles() == null
            || refreshed.getRoles().stream()
                .noneMatch(r -> BOT_IMPERSONATION_ROLE.equals(r.getName())),
        "Revoking must detach BotImpersonationRole");
  }

  @Test
  void test_patchUserAllowImpersonation_rejected(TestNamespace ns) {
    User botUser = createBotUser(ns, "patch");

    User fetched = SdkClients.adminClient().users().getByName(botUser.getName());
    fetched.setAllowImpersonation(true);

    Exception exception =
        assertThrows(
            Exception.class,
            () -> SdkClients.adminClient().users().update(fetched.getId().toString(), fetched),
            "Patching allowImpersonation on the user must be rejected");
    assertTrue(
        exception.getMessage().contains("can't be modified"),
        "Error should state the attribute is read-only: " + exception.getMessage());
  }

  @Test
  void test_impersonation_endToEnd_defaultPolicyAllowsAllTargets(TestNamespace ns) {
    User target = createRegularUser(ns, "target");
    User botUser = createBotUser(ns, "e2e");
    createBot(ns.prefix("imp_e2e_bot"), botUser, true);
    String botToken = generateBotToken(botUser);

    OpenMetadataClient asTarget = impersonationClient(botToken, target.getName());
    User seen = assertDoesNotThrow(() -> asTarget.users().getByName(target.getName()));
    assertEquals(
        target.getName().toLowerCase(),
        seen.getName().toLowerCase(),
        "Impersonated request for a regular user must succeed");

    OpenMetadataClient asAdmin = impersonationClient(botToken, "admin");
    User adminSeen =
        assertDoesNotThrow(
            () -> asAdmin.users().getByName("admin"),
            "Default BotImpersonationPolicy is permissive - admin impersonation stays allowed");
    assertEquals("admin", adminSeen.getName());
  }

  @Test
  void test_nonAdminRole_deniesAdminTarget(TestNamespace ns) {
    User target = createRegularUser(ns, "natarget");
    User botUser = createBotUser(ns, "nonadmin");
    createBot(ns.prefix("imp_nonadmin_bot"), botUser, true);
    swapImpersonationRole(botUser, BOT_NON_ADMIN_IMPERSONATION_ROLE);
    String botToken = generateBotToken(botUser);

    OpenMetadataClient asTarget = impersonationClient(botToken, target.getName());
    User seen =
        assertDoesNotThrow(
            () -> asTarget.users().getByName(target.getName()),
            "BotNonAdminImpersonationRole must still allow impersonating regular users");
    assertEquals(target.getName().toLowerCase(), seen.getName().toLowerCase());

    OpenMetadataClient asAdmin = impersonationClient(botToken, "admin");
    Exception adminDenied =
        assertThrows(
            Exception.class,
            () -> asAdmin.users().getByName("admin"),
            "BotNonAdminImpersonationPolicy must deny impersonating admins");
    assertTrue(
        adminDenied.getMessage().contains("not authorized to impersonate"),
        "Error should state the target is not allowed: " + adminDenied.getMessage());
  }

  @Test
  void test_impersonationWithoutGrant_rejected(TestNamespace ns) {
    User target = createRegularUser(ns, "ngtarget");
    User botUser = createBotUser(ns, "nogrant");
    createBot(ns.prefix("imp_nogrant_bot"), botUser, null);
    String botToken = generateBotToken(botUser);

    OpenMetadataClient asTarget = impersonationClient(botToken, target.getName());
    Exception denied =
        assertThrows(
            Exception.class,
            () -> asTarget.users().getByName(target.getName()),
            "Bot without the grant must not impersonate");
    assertTrue(
        denied.getMessage().contains("does not have impersonation enabled"),
        "Error should state impersonation is not enabled: " + denied.getMessage());
  }

  @Test
  void test_putCreateWithImpersonation_grantsFlagAndRole(TestNamespace ns) {
    User botUser = createBotUser(ns, "putgrant");
    String botName = ns.prefix("imp_putcreate_bot");

    Bot bot = putBot(SdkClients.adminClient(), botName, botUser, true);
    assertNotNull(bot);

    User refreshed = getBotUser(botUser.getName());
    assertTrue(
        Boolean.TRUE.equals(refreshed.getAllowImpersonation()),
        "PUT that creates the bot with the grant must enable allowImpersonation");
    assertTrue(
        refreshed.getRoles().stream().anyMatch(r -> BOT_IMPERSONATION_ROLE.equals(r.getName())),
        "PUT-create with the grant must attach BotImpersonationRole");
  }

  @Test
  void test_repeatedGrantViaPutIsIdempotent(TestNamespace ns) {
    User botUser = createBotUser(ns, "idem");
    String botName = ns.prefix("imp_idem_bot");
    createBot(botName, botUser, true);

    Bot updated = putBot(SdkClients.adminClient(), botName, botUser, true);
    assertNotNull(updated, "Re-applying the same grant via PUT must succeed, not be rejected");

    User refreshed = getBotUser(botUser.getName());
    assertTrue(
        Boolean.TRUE.equals(refreshed.getAllowImpersonation()),
        "Idempotent re-grant must stay enabled");
    assertTrue(
        refreshed.getRoles().stream().anyMatch(r -> BOT_IMPERSONATION_ROLE.equals(r.getName())),
        "Idempotent re-grant must keep BotImpersonationRole");
  }

  @Test
  void test_nonAdminCannotGrantViaPut(TestNamespace ns) {
    User botUser = createBotUser(ns, "naput");
    String botName = ns.prefix("imp_naput_bot");

    Exception exception =
        assertThrows(
            Exception.class,
            () -> putBot(SdkClients.user1Client(), botName, botUser, true),
            "Non-admin must not grant impersonation via PUT");
    assertTrue(
        exception.getMessage().contains("admin")
            || exception.getMessage().contains("Authorization"),
        "Error should mention admin or authorization: " + exception.getMessage());

    User refreshed = getBotUser(botUser.getName());
    assertFalse(
        Boolean.TRUE.equals(refreshed.getAllowImpersonation()),
        "Rejected non-admin PUT must not enable the grant");
  }

  @Test
  void test_nonAdminCannotRevoke(TestNamespace ns) {
    User botUser = createBotUser(ns, "narevoke");
    String botName = ns.prefix("imp_narevoke_bot");
    createBot(botName, botUser, true);

    Exception exception =
        assertThrows(
            Exception.class,
            () -> putBot(SdkClients.user1Client(), botName, botUser, false),
            "Non-admin must not revoke impersonation");
    assertTrue(
        exception.getMessage().contains("admin")
            || exception.getMessage().contains("Authorization"),
        "Error should mention admin or authorization: " + exception.getMessage());

    User refreshed = getBotUser(botUser.getName());
    assertTrue(
        Boolean.TRUE.equals(refreshed.getAllowImpersonation()),
        "Rejected non-admin revoke must leave the grant intact");
  }

  private Bot putBot(
      OpenMetadataClient client, String botName, User botUser, Boolean allowImpersonation) {
    CreateBot request =
        new CreateBot()
            .withName(botName)
            .withDescription("Bot for impersonation tests")
            .withBotUser(botUser.getName())
            .withAllowImpersonation(allowImpersonation);
    return client.getHttpClient().execute(HttpMethod.PUT, "/v1/bots", request, Bot.class);
  }

  private void swapImpersonationRole(User botUser, String roleName) {
    Role role = SdkClients.adminClient().roles().getByName(roleName);
    User fetched = SdkClients.adminClient().users().getByName(botUser.getName(), USER_FIELDS);
    fetched.setRoles(List.of(role.getEntityReference()));
    SdkClients.adminClient().users().update(fetched.getId().toString(), fetched);
  }

  private User createBotUser(TestNamespace ns, String suffix) {
    // The bot authenticates with its own JWT, and JwtFilter resolves the bot's username from the
    // email local-part. The stored name must equal that local-part so impersonation lookups (by the
    // resolved bot name) resolve. Keep it short and alphanumeric for a valid email.
    String localPart = "impbot" + suffix + ns.shortPrefix();

    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));

    CreateUser request =
        new CreateUser()
            .withName(localPart)
            .withEmail(localPart + "@test.com")
            .withDescription("Bot user for impersonation tests")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism);

    return SdkClients.adminClient().users().create(request);
  }

  private User createRegularUser(TestNamespace ns, String suffix) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String userName = ns.prefix("imptarget_" + suffix + "_" + uniqueId);
    Role dataConsumer = SdkClients.adminClient().roles().getByName("DataConsumer");

    CreateUser request =
        new CreateUser()
            .withName(userName)
            .withEmail("imptarget" + suffix + uniqueId + "@test.com")
            .withDescription("Impersonation target user")
            .withRoles(List.of(dataConsumer.getId()));

    return SdkClients.adminClient().users().create(request);
  }

  private Bot createBot(String botName, User botUser, Boolean allowImpersonation) {
    CreateBot request =
        new CreateBot()
            .withName(botName)
            .withDescription("Bot for impersonation tests")
            .withBotUser(botUser.getName())
            .withAllowImpersonation(allowImpersonation);
    return SdkClients.adminClient().bots().create(request);
  }

  private User getBotUser(String botUserName) {
    return SdkClients.adminClient().users().getByName(botUserName, USER_FIELDS);
  }

  private String generateBotToken(User botUser) {
    JWTAuthMechanism auth =
        SdkClients.adminClient().users().generateToken(botUser.getId(), JWTTokenExpiry.Seven);
    assertNotNull(auth.getJWTToken(), "Bot token generation must return a token");
    return auth.getJWTToken();
  }

  private OpenMetadataClient impersonationClient(String botToken, String targetUserName) {
    OpenMetadataConfig config =
        OpenMetadataConfig.builder()
            .serverUrl(SdkClients.baseUrl())
            .accessToken(botToken)
            .header(IMPERSONATE_HEADER, targetUserName)
            .readTimeout(300000)
            .writeTimeout(300000)
            .build();
    return new OpenMetadataClient(config);
  }
}
