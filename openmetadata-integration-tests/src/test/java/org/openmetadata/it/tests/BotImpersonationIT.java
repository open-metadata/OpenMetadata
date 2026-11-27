package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.ChangeEventLog;
import org.openmetadata.it.util.ChangeEventLog.EventAuthor;
import org.openmetadata.it.util.EntityRulesUtil;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.it.util.UriTestUtils;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.MoveGlossaryTermRequest;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.DescriptionUpdatePayload;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.EntityRepository;

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
  private static final String APPLICATION_BOT_IMPERSONATION_ROLE =
      "ApplicationBotImpersonationRole";
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
  void test_impersonatedAdmin_cannotAddTeamRolesOrImportTeams(TestNamespace ns) {
    User botUser = createBotUser(ns, "teamgrant");
    createBot(ns.prefix("imp_teamgrant_bot"), botUser, true);
    OpenMetadataClient asAdmin = impersonationClient(generateBotToken(botUser), "admin");
    Team team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("impTeamGrant"))
                    .withTeamType(CreateTeam.TeamType.GROUP));
    Role dataSteward = SdkClients.adminClient().roles().getByName("DataSteward");
    String addRole =
        "[{\"op\":\"add\",\"path\":\"/defaultRoles\",\"value\":[{\"id\":\"%s\",\"type\":\"role\"}]}]"
            .formatted(dataSteward.getId());
    String teamPath = "/v1/teams/" + team.getId();

    assertThrows(
        ForbiddenException.class,
        () ->
            asAdmin
                .getHttpClient()
                .executeForString(HttpMethod.PATCH, teamPath, JsonUtils.readTree(addRole)));
    assertThrows(
        ForbiddenException.class,
        () -> asAdmin.teams().importCsv(team.getName(), "name*,teamType*\n", true));

    // Other team edits are unaffected
    String rename = "[{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"renamed\"}]";
    assertDoesNotThrow(
        () ->
            asAdmin
                .getHttpClient()
                .executeForString(HttpMethod.PATCH, teamPath, JsonUtils.readTree(rename)));
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
  void test_nonAdminRole_deniesBotTarget(TestNamespace ns) {
    User botUser = createBotUser(ns, "nabot");
    createBot(ns.prefix("imp_nabot_bot"), botUser, true);
    swapImpersonationRole(botUser, BOT_NON_ADMIN_IMPERSONATION_ROLE);
    String botToken = generateBotToken(botUser);

    OpenMetadataClient asIngestionBot = impersonationClient(botToken, "ingestion-bot");
    Exception botDenied =
        assertThrows(
            Exception.class,
            () -> asIngestionBot.users().getByName("ingestion-bot"),
            "BotNonAdminImpersonationPolicy must deny impersonating bots");
    assertTrue(
        botDenied.getMessage().contains("not authorized to impersonate"),
        "Error should state the target is not allowed: " + botDenied.getMessage());
  }

  @Test
  void test_nonAdminRole_deniesAdminTargetOnAdminOnlyEndpoint(TestNamespace ns) {
    // GET /v1/system/settings is guarded by authorizeAdmin, which resolves the effective subject
    // rather than the bot, so the bot's impersonation policy still decides the outcome.
    User botUser = createBotUser(ns, "adminguard");
    createBot(ns.prefix("imp_adminguard_bot"), botUser, true);
    swapImpersonationRole(botUser, BOT_NON_ADMIN_IMPERSONATION_ROLE);
    String botToken = generateBotToken(botUser);

    OpenMetadataClient asAdmin = impersonationClient(botToken, "admin");
    Exception denied =
        assertThrows(
            Exception.class,
            () ->
                asAdmin
                    .getHttpClient()
                    .executeForString(HttpMethod.GET, "/v1/system/settings", null),
            "Admin-only endpoints must enforce the bot's impersonation policy");
    assertTrue(
        denied.getMessage().contains("not authorized to impersonate"),
        "Error should state the target is not allowed: " + denied.getMessage());
  }

  /**
   * A role that allows impersonation only within the bot's domains must see the target's domains.
   * The target used to be evaluated as loaded by the token filter, without domains, so {@code
   * hasDomain()} read "no domains" and allowed every target.
   */
  @Test
  void test_domainScopedRole_deniesTargetOutsideTheBotsDomains(TestNamespace ns) {
    Domain domain =
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.shortPrefix("impdomain"))
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Domain the impersonating bot does not belong to"));
    User inDomain = createRegularUser(ns, "indomain", domain.getFullyQualifiedName());
    User withoutDomain = createRegularUser(ns, "nodomain");
    User botUser = createBotUser(ns, "domscoped");
    createBot(ns.prefix("imp_domscoped_bot"), botUser, true);
    swapImpersonationRole(botUser, createDomainScopedImpersonationRole(ns).getName());
    String botToken = generateBotToken(botUser);

    OpenMetadataClient asUnscoped = impersonationClient(botToken, withoutDomain.getName());
    assertDoesNotThrow(
        () -> asUnscoped.users().getByName(withoutDomain.getName()),
        "A target with no domain is within hasDomain() and stays impersonable");

    OpenMetadataClient asOutsider = impersonationClient(botToken, inDomain.getName());
    Exception denied =
        assertThrows(
            Exception.class,
            () -> asOutsider.users().getByName(inDomain.getName()),
            "hasDomain() must be evaluated against the target's domains");
    assertTrue(
        denied.getMessage().contains("not authorized to impersonate"),
        "Error should state the target is not allowed: " + denied.getMessage());
  }

  @Test
  void test_applicationBotRole_impersonatesIncludingAdmin(TestNamespace ns) {
    // Backward compatibility: existing application bots use ApplicationBotImpersonationRole
    // (ApplicationBotImpersonationPolicy = allow Impersonate on All, no deny rules). The new
    // policy-evaluation path must keep allowing them to impersonate any user, including admins.
    User target = createRegularUser(ns, "appbottarget");
    User botUser = createBotUser(ns, "appbot");
    createBot(ns.prefix("imp_appbot_bot"), botUser, true);
    swapImpersonationRole(botUser, APPLICATION_BOT_IMPERSONATION_ROLE);
    String botToken = generateBotToken(botUser);

    OpenMetadataClient asTarget = impersonationClient(botToken, target.getName());
    User seen =
        assertDoesNotThrow(
            () -> asTarget.users().getByName(target.getName()),
            "Application bot role must still allow impersonating regular users");
    assertEquals(target.getName().toLowerCase(), seen.getName().toLowerCase());

    OpenMetadataClient asAdmin = impersonationClient(botToken, "admin");
    User adminSeen =
        assertDoesNotThrow(
            () -> asAdmin.users().getByName("admin"),
            "ApplicationBotImpersonationPolicy (All/allow) must still permit impersonating admins");
    assertEquals("admin", adminSeen.getName());
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

  @Test
  void test_getPersonalAccessToken_whileImpersonating_rejected(TestNamespace ns) {
    // Listing returns the raw jwtToken; an impersonating bot could otherwise exfiltrate the
    // target's PAT and authenticate as them outside the impersonation flow.
    User target = createRegularUser(ns, "listtarget");
    User botUser = createBotUser(ns, "listpat");
    createBot(ns.prefix("imp_listpat_bot"), botUser, true);
    String botToken = generateBotToken(botUser);

    OpenMetadataClient asTarget = impersonationClient(botToken, target.getName());
    Exception denied =
        assertThrows(
            Exception.class,
            () ->
                asTarget
                    .getHttpClient()
                    .executeForString(HttpMethod.GET, "/v1/users/security/token", null),
            "Listing personal access tokens while impersonating must be rejected");
    assertTrue(
        denied.getMessage().contains("identity endpoint"),
        "List must be blocked as an identity endpoint: " + denied.getMessage());
  }

  @Test
  void test_revokePersonalAccessToken_whileImpersonating_rejected(TestNamespace ns) {
    // The create path already blocks minting a PAT under impersonation; revoke is the same
    // self-scoped operation and must be blocked too, even for a bot otherwise allowed to
    // impersonate the target (the default policy permits regular users).
    User target = createRegularUser(ns, "revoketarget");
    User botUser = createBotUser(ns, "revokepat");
    createBot(ns.prefix("imp_revokepat_bot"), botUser, true);
    String botToken = generateBotToken(botUser);

    OpenMetadataClient asTarget = impersonationClient(botToken, target.getName());
    Exception denied =
        assertThrows(
            Exception.class,
            () ->
                asTarget
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.PUT,
                        "/v1/users/security/token/revoke?removeAll=false",
                        "{\"tokenIds\":[\"" + UUID.randomUUID() + "\"]}"),
            "Revoking a personal access token while impersonating must be rejected");
    assertTrue(
        denied.getMessage().contains("identity endpoint"),
        "Revoke must be blocked as an identity endpoint: " + denied.getMessage());
  }

  @Test
  void test_impersonation_withRotatedBotToken_rejected(TestNamespace ns) {
    // Bot tokens are revoked by rotation (the stored token changes). A leaked, since-rotated token
    // must not keep working just because an X-Impersonate-User header is attached.
    User target = createRegularUser(ns, "rotatetarget");
    User botUser = createBotUser(ns, "rotate");
    createBot(ns.prefix("imp_rotate_bot"), botUser, true);

    String oldToken =
        SdkClients.adminClient()
            .users()
            .generateToken(botUser.getId(), JWTTokenExpiry.Seven)
            .getJWTToken();
    // Rotate: the previously issued token is now stale.
    SdkClients.adminClient().users().generateToken(botUser.getId(), JWTTokenExpiry.Ninety);

    OpenMetadataClient asTarget = impersonationClient(oldToken, target.getName());
    Exception denied =
        assertThrows(
            Exception.class,
            () -> asTarget.users().getByName(target.getName()),
            "A rotated bot token must not authenticate even with an impersonation header");
    assertTrue(
        denied.getMessage().contains("does not match the current bot's token"),
        "Rotated bot token must be rejected by bot-token validation: " + denied.getMessage());
  }

  @Test
  void test_impersonation_cannotGenerateJwtForTarget(TestNamespace ns) {
    User target = createRegularUser(ns, "jwtmint");
    OpenMetadataClient asTarget = grantedBotImpersonating(ns, "jwtmint", target.getName());

    assertThrows(
        Exception.class,
        () ->
            asTarget
                .getHttpClient()
                .executeForString(
                    HttpMethod.POST,
                    "/v1/users/generateToken",
                    Map.of("id", target.getId().toString(), "JWTTokenExpiry", "OneHour"),
                    null),
        "An impersonated request must not mint a JWT for the target");
  }

  @Test
  void test_impersonation_cannotReachCredentialEndpointEvenWithGrant(TestNamespace ns) {
    // The grant scopes who a bot may act as, not what it may take. generateRandomPwd is part of
    // the credential surface, so it stays closed even for a fully authorized impersonation.
    OpenMetadataClient asAdmin = grantedBotImpersonating(ns, "randompwd", "admin");

    Exception denied =
        assertThrows(
            Exception.class,
            () ->
                asAdmin
                    .getHttpClient()
                    .executeForString(HttpMethod.GET, "/v1/users/generateRandomPwd", null),
            "An impersonated request must not reach the credential surface");
    assertTrue(
        denied.getMessage().contains("identity endpoint"),
        "Error should name the identity endpoint: " + denied.getMessage());
  }

  @Test
  void test_impersonation_cannotMintBotCredentialViaUserCreate(TestNamespace ns) {
    // User creation is an identity endpoint, so creating a bot user is refused while impersonating,
    // even an admin.
    OpenMetadataClient asAdmin = grantedBotImpersonating(ns, "mintbot", "admin");
    String name = "mintedbot" + ns.shortPrefix();

    Exception denied =
        assertThrows(
            Exception.class,
            () ->
                asAdmin
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.POST,
                        "/v1/users",
                        Map.of(
                            "name",
                            name,
                            "email",
                            name + "@test.com",
                            "isBot",
                            true,
                            "authenticationMechanism",
                            Map.of(
                                "authType",
                                "JWT",
                                "config",
                                Map.of("JWTTokenExpiry", "Unlimited"))),
                        null),
            "An impersonated request must not mint a bot credential through user create");
    assertTrue(
        denied.getMessage().contains("identity endpoint"),
        "Bot mint must be blocked as an identity endpoint: " + denied.getMessage());
  }

  @Test
  void test_impersonation_cannotSetTeamDefaultPersona(TestNamespace ns) {
    // Every member of a Group inherits its default persona after the request ends, so an
    // impersonated admin can set it neither on create nor on patch.
    OpenMetadataClient admin = SdkClients.adminClient();
    Persona persona =
        admin.personas().create(new CreatePersona().withName(ns.prefix("imp_team_persona")));
    Team team =
        admin
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("imp_persona_team"))
                    .withTeamType(CreateTeam.TeamType.GROUP));
    OpenMetadataClient asAdmin = grantedBotImpersonating(ns, "teampersona", "admin");
    String patch =
        "[{\"op\":\"add\",\"path\":\"/defaultPersona\",\"value\":{\"id\":\""
            + persona.getId()
            + "\",\"type\":\"persona\"}}]";
    String create =
        "{\"name\":\""
            + ns.prefix("imp_persona_new_team")
            + "\",\"teamType\":\"Group\",\"defaultPersona\":\""
            + persona.getId()
            + "\"}";

    Exception patchDenied =
        assertThrows(
            Exception.class,
            () ->
                asAdmin
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.PATCH, "/v1/teams/" + team.getId(), JsonUtils.readTree(patch)));
    Exception createDenied =
        assertThrows(
            Exception.class,
            () -> asAdmin.getHttpClient().executeForString(HttpMethod.POST, "/v1/teams", create));

    for (Exception denied : List.of(patchDenied, createDenied)) {
      assertTrue(
          denied.getMessage().contains("Impersonated requests cannot set a team's default persona"),
          "Impersonated default persona grant must be refused: " + denied.getMessage());
    }
    assertNull(
        admin.teams().get(team.getId().toString(), "defaultPersona").getDefaultPersona(),
        "The team must not gain the persona");
  }

  @Test
  void test_impersonation_cannotGrantPrivilegesThroughUserPatch(TestNamespace ns) {
    // PATCH reaches the same privileged fields as POST and PUT, so making a user admin or giving
    // them a role while impersonating an admin is refused the same way.
    User target = createRegularUser(ns, "patchgrant");
    OpenMetadataClient asAdmin = grantedBotImpersonating(ns, "patchgrant", "admin");
    Role dataSteward = SdkClients.adminClient().roles().getByName("DataSteward");
    List<String> patches =
        List.of(
            "[{\"op\":\"replace\",\"path\":\"/isAdmin\",\"value\":true}]",
            "[{\"op\":\"add\",\"path\":\"/roles/0\",\"value\":{\"id\":\""
                + dataSteward.getId()
                + "\",\"type\":\"role\"}}]");

    for (String patch : patches) {
      Exception denied =
          assertThrows(
              Exception.class,
              () ->
                  asAdmin
                      .getHttpClient()
                      .executeForString(
                          HttpMethod.PATCH,
                          "/v1/users/" + target.getId(),
                          JsonUtils.readTree(patch)),
              "An impersonated PATCH must not grant privileges: " + patch);
      assertTrue(
          denied.getMessage().contains("Impersonated requests cannot grant privileges"),
          "Privileged PATCH must be refused: " + denied.getMessage());
    }
    User unchanged = SdkClients.adminClient().users().getByName(target.getName(), "roles");
    assertFalse(Boolean.TRUE.equals(unchanged.getIsAdmin()), "Target must not become admin");
    assertFalse(
        unchanged.getRoles().stream().anyMatch(role -> role.getId().equals(dataSteward.getId())),
        "Target must not gain the role");
  }

  @Test
  void test_impersonation_cannotCreateBot(TestNamespace ns) {
    // The /v1/bots write surface is identity management; an impersonated request has no business
    // creating or altering a bot.
    User botUser = createBotUser(ns, "makebot");
    OpenMetadataClient asAdmin = grantedBotImpersonating(ns, "makebotcaller", "admin");

    Exception denied =
        assertThrows(
            Exception.class,
            () ->
                asAdmin
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.POST,
                        "/v1/bots",
                        Map.of("name", ns.prefix("newbot"), "botUser", botUser.getName()),
                        null),
            "An impersonated request must not create a bot");
    assertTrue(
        denied.getMessage().contains("identity endpoint"),
        "Bot creation must be blocked as an identity endpoint: " + denied.getMessage());
  }

  @Test
  void test_impersonation_cannotCreateUserThroughPost(TestNamespace ns) {
    // Creating a user is refused while impersonating, even an admin. The same request sent by the
    // admin directly still creates the user.
    OpenMetadataClient asAdmin = grantedBotImpersonating(ns, "postuser", "admin");
    String name = "imppostuser" + ns.shortPrefix();
    CreateUser request = new CreateUser().withName(name).withEmail(name + "@test.com");

    ForbiddenException denied =
        assertThrows(
            ForbiddenException.class,
            () ->
                asAdmin.getHttpClient().execute(HttpMethod.POST, "/v1/users", request, User.class),
            "An impersonated request must not create a user");
    assertTrue(
        denied.getMessage().contains("identity endpoint"),
        "User creation must be blocked as an identity endpoint: " + denied.getMessage());

    User created = SdkClients.adminClient().users().create(request);
    assertEquals(name, created.getName());
  }

  @Test
  void test_impersonation_cannotCreateUserThroughPut(TestNamespace ns) {
    // PUT creates the user when the name is new. Only that branch is refused while impersonating:
    // updating an existing user keeps working, and the admin can still create the user directly.
    User existing = createRegularUser(ns, "putexisting");
    OpenMetadataClient asAdmin = grantedBotImpersonating(ns, "putuser", "admin");
    String name = "impputuser" + ns.shortPrefix();
    CreateUser create = new CreateUser().withName(name).withEmail(name + "@test.com");

    ForbiddenException denied =
        assertThrows(
            ForbiddenException.class,
            () -> asAdmin.getHttpClient().execute(HttpMethod.PUT, "/v1/users", create, User.class),
            "An impersonated PUT must not create a user");
    assertTrue(
        denied.getMessage().contains("Impersonated requests cannot"),
        "User creation through PUT must be refused: " + denied.getMessage());

    CreateUser update =
        new CreateUser()
            .withName(existing.getName())
            .withEmail(existing.getEmail())
            .withDescription("Updated while impersonating");
    User updated =
        assertDoesNotThrow(
            () -> asAdmin.getHttpClient().execute(HttpMethod.PUT, "/v1/users", update, User.class),
            "An impersonated PUT must still update an existing user");
    assertEquals("Updated while impersonating", updated.getDescription());

    User created =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.PUT, "/v1/users", create, User.class);
    assertEquals(name, created.getName());
  }

  @Test
  void test_impersonation_cannotImportUsers(TestNamespace ns) {
    // Both user import endpoints are refused while impersonating, even an admin. A dry run keeps
    // the direct admin call from changing anything.
    Team team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.shortPrefix("impimportteam"))
                    .withTeamType(CreateTeam.TeamType.GROUP));
    String name = "impimportuser" + ns.shortPrefix();
    String csv =
        "name*,displayName,description,email*,timezone,isAdmin,teams*,Roles\n"
            + String.join(
                ",",
                name,
                name,
                "imported by test",
                name + "@test.com",
                "",
                "false",
                team.getName(),
                "")
            + "\n";
    OpenMetadataClient asAdmin = grantedBotImpersonating(ns, "importusers", "admin");

    for (String path : List.of("/v1/users/import", "/v1/users/importAsync")) {
      ForbiddenException denied =
          assertThrows(
              ForbiddenException.class,
              () -> importUsers(asAdmin, path, team.getName(), csv),
              "An impersonated request must not import users through " + path);
      assertTrue(
          denied.getMessage().contains("identity endpoint"),
          path + " must be blocked as an identity endpoint: " + denied.getMessage());
    }

    CsvImportResult result =
        JsonUtils.readValue(
            importUsers(SdkClients.adminClient(), "/v1/users/import", team.getName(), csv),
            CsvImportResult.class);
    assertEquals(ApiStatus.SUCCESS, result.getStatus(), "Direct admin import must still work");
    String job =
        importUsers(SdkClients.adminClient(), "/v1/users/importAsync", team.getName(), csv);
    assertTrue(job.contains("jobId"), "Direct admin async import must still start: " + job);
  }

  @Test
  void test_impersonation_cannotRestoreUser(TestNamespace ns) {
    // Restoring a soft-deleted user is refused while impersonating, through PUT /v1/users and
    // through the restore endpoint. The admin can still restore the user directly.
    User deleted = createRegularUser(ns, "restored");
    SdkClients.adminClient().users().delete(deleted.getId());
    OpenMetadataClient asAdmin = grantedBotImpersonating(ns, "restoreuser", "admin");
    CreateUser put =
        new CreateUser()
            .withName(deleted.getName())
            .withEmail(deleted.getEmail())
            .withDescription("Restored while impersonating");

    ForbiddenException putDenied =
        assertThrows(
            ForbiddenException.class,
            () -> asAdmin.getHttpClient().execute(HttpMethod.PUT, "/v1/users", put, User.class),
            "An impersonated PUT must not restore a deleted user");
    assertTrue(
        putDenied.getMessage().contains("Impersonated requests cannot"),
        "Restoring through PUT must be refused: " + putDenied.getMessage());

    ForbiddenException restoreDenied =
        assertThrows(
            ForbiddenException.class,
            () -> asAdmin.users().restore(deleted.getId()),
            "An impersonated request must not restore a deleted user");
    assertTrue(
        restoreDenied.getMessage().contains("identity endpoint"),
        "Restore must be blocked as an identity endpoint: " + restoreDenied.getMessage());

    User restored = SdkClients.adminClient().users().restore(deleted.getId());
    assertFalse(Boolean.TRUE.equals(restored.getDeleted()), "Direct admin restore must still work");
  }

  @Test
  void test_impersonation_cannotChangeSecurityConfiguration(TestNamespace ns) {
    // Writes to the security configuration are refused while impersonating, even an admin. Direct
    // admin writes are covered by SystemResourceIT, which runs isolated because a write reloads the
    // authentication system.
    OpenMetadataClient asAdmin = grantedBotImpersonating(ns, "securityconfig", "admin");
    String current =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/system/security/config", null);

    List<IdentityCall> calls =
        List.of(
            new IdentityCall(HttpMethod.PUT, "/v1/system/security/config", current),
            new IdentityCall(
                HttpMethod.PATCH, "/v1/system/security/config", JsonUtils.readTree("[]")),
            new IdentityCall(
                HttpMethod.POST,
                "/v1/system/settings/source/authenticationConfiguration/adopt",
                Map.of()));
    for (IdentityCall call : calls) {
      ForbiddenException denied =
          assertThrows(
              ForbiddenException.class,
              () ->
                  asAdmin.getHttpClient().executeForString(call.method(), call.path(), call.body()),
              call.method() + " " + call.path() + " must be refused while impersonating");
      assertTrue(
          denied.getMessage().contains("identity endpoint"),
          call.method() + " must be blocked as an identity endpoint: " + denied.getMessage());
    }
  }

  @Test
  void test_impersonation_cannotWritePoliciesOrRoles(TestNamespace ns) {
    OpenMetadataClient asAdmin = grantedBotImpersonating(ns, "rbacwrite", "admin");
    Policy policy = SdkClients.adminClient().policies().getByName("BotNonAdminImpersonationPolicy");
    Role role = SdkClients.adminClient().roles().getByName(BOT_NON_ADMIN_IMPERSONATION_ROLE);
    JsonNode describe =
        JsonUtils.readTree("[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"edited\"}]");

    List<IdentityCall> calls =
        List.of(
            new IdentityCall(HttpMethod.PATCH, "/v1/policies/" + policy.getId(), describe),
            new IdentityCall(HttpMethod.PATCH, "/v1/roles/" + role.getId(), describe));
    for (IdentityCall call : calls) {
      ForbiddenException denied =
          assertThrows(
              ForbiddenException.class,
              () ->
                  asAdmin.getHttpClient().executeForString(call.method(), call.path(), call.body()),
              call.method() + " " + call.path() + " must be refused while impersonating");
      assertTrue(
          denied.getMessage().contains("identity endpoint"),
          call.path() + " must be blocked as an identity endpoint: " + denied.getMessage());
    }
    assertEquals(
        policy.getDescription(),
        SdkClients.adminClient().policies().get(policy.getId().toString()).getDescription());
  }

  private static String importUsers(
      OpenMetadataClient client, String path, String team, String csv) {
    return client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            path,
            csv,
            RequestOptions.builder()
                .header("Content-Type", "text/plain; charset=UTF-8")
                .queryParam("team", team)
                .queryParam("dryRun", "true")
                .build());
  }

  @Test
  void test_identityEndpoints_deniedForEveryRoutedSpelling(TestNamespace ns) {
    // Jersey drops matrix parameters and a trailing slash before it picks the method, so each of
    // these spellings reaches the same handler and must be refused like the canonical path.
    User target = createRegularUser(ns, "spelling");
    OpenMetadataClient asTarget = grantedBotImpersonating(ns, "spelling", target.getName());
    List<IdentityCall> calls =
        List.of(
            new IdentityCall(
                HttpMethod.POST,
                "/v1/users/generateToken",
                Map.of("id", target.getId().toString(), "JWTTokenExpiry", "OneHour")),
            new IdentityCall(
                HttpMethod.PUT,
                "/v1/users/security/token",
                Map.of("tokenName", "spelling", "JWTTokenExpiry", "OneHour")),
            new IdentityCall(HttpMethod.GET, "/v1/users/security/token", null),
            new IdentityCall(
                HttpMethod.PUT,
                "/v1/users/changePassword",
                Map.of(
                    "oldPassword", "Wrong@Passw0rd1",
                    "newPassword", "Spelling@Passw0rd1",
                    "confirmPassword", "Spelling@Passw0rd1",
                    "requestType", "SELF")),
            new IdentityCall(HttpMethod.POST, "/v1/users/logout", Map.of("token", "not-a-token")),
            new IdentityCall(HttpMethod.GET, "/v1/users/generateRandomPwd", null));

    for (IdentityCall call : calls) {
      for (String suffix : List.of("", ";x=1", "/", ";x=1/")) {
        String path = call.path() + suffix;
        Exception denied =
            assertThrows(
                Exception.class,
                () -> asTarget.getHttpClient().executeForString(call.method(), path, call.body()),
                call.method() + " " + path + " must be refused while impersonating");
        assertTrue(
            denied.getMessage().contains("identity endpoint"),
            call.method()
                + " "
                + path
                + " must be blocked as an identity endpoint: "
                + denied.getMessage());
      }
    }
  }

  @Test
  void test_ordinaryEndpoint_withMatrixParam_staysOpenToImpersonation(TestNamespace ns) {
    // Control for the test above: the refusal comes from the identity binding, not from matrix
    // parameters breaking routing for impersonated requests in general.
    User target = createRegularUser(ns, "matrixok");
    OpenMetadataClient asTarget = grantedBotImpersonating(ns, "matrixok", target.getName());

    String body =
        assertDoesNotThrow(
            () ->
                asTarget
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.GET, "/v1/users/" + target.getId() + ";x=1", null));
    assertTrue(body.contains(target.getName()), "Expected the target user back: " + body);
  }

  @Test
  void test_impersonatedEdit_isVersionedApartFromTheTargetsOwnEdits(TestNamespace ns) {
    User target = createRegularUser(ns, "versions");
    Impersonation impersonation = impersonating(ns, "versions", target);
    OpenMetadataClient direct = directClient(target);
    Glossary glossary = createGlossary(ns, "impversions");

    // All three edits land inside one session window, where edits by the same user fold into a
    // single version: the bot's edit must still keep a version of its own.
    patchDescription(direct, glossary, "Written by the user");
    patchDescription(impersonation.viaBot(), glossary, "Written by the bot for the user");
    patchDescription(direct, glossary, "Written by the user again");

    assertEquals(
        List.of(
            new VersionAuthor(0.4, target.getName(), null),
            new VersionAuthor(0.3, target.getName(), impersonation.bot()),
            new VersionAuthor(0.2, target.getName(), null),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        glossaryVersionAuthors(glossary.getId()),
        "Each version must name who made it and the bot that made it for them");
  }

  @Test
  void test_impersonatedEditsInOneSession_foldIntoOneVersion(TestNamespace ns) {
    User target = createRegularUser(ns, "fold");
    Impersonation impersonation = impersonating(ns, "fold", target);
    Glossary glossary = createGlossary(ns, "impfold");

    patchDescription(impersonation.viaBot(), glossary, "Written by the bot for the user");
    patchDescription(impersonation.viaBot(), glossary, "Rewritten by the bot for the user");

    assertEquals(
        List.of(
            new VersionAuthor(0.2, target.getName(), impersonation.bot()),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        glossaryVersionAuthors(glossary.getId()),
        "Edits one bot makes for one user within a session must still fold into one version");
  }

  @Test
  void test_directLifecycleEdit_keepsTheBotOfTheCurrentVersion(TestNamespace ns) {
    OpenMetadataClient direct = SdkClients.adminClient();
    User admin = direct.users().getByName(ADMIN_USER_NAME);
    Impersonation impersonation = impersonating(ns, "lifecycle", admin);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    Table table = direct.tables().create(tableRequest(ns, schema, "lifecycle"));
    String tableId = table.getId().toString();
    impersonation.viaBot().tables().patch(tableId, descriptionPatch("Written by the bot"));

    LifeCycle lifecycle =
        new LifeCycle().withAccessed(new AccessDetails().withTimestamp(1695060100L));
    direct
        .tables()
        .patch(
            tableId,
            JsonUtils.valueToTree(
                List.of(Map.of("op", "add", "path", "/lifeCycle", "value", lifecycle))));

    assertEquals(
        lifecycle.getAccessed().getTimestamp(),
        direct.tables().get(tableId, "lifeCycle").getLifeCycle().getAccessed().getTimestamp());
    assertEquals(
        List.of(
            new VersionAuthor(0.2, ADMIN_USER_NAME, impersonation.bot()),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        versionAuthors(direct.tables().getVersionList(table.getId())));
  }

  @Test
  void test_editUndoneInItsSession_keepsTheBotOfTheVersionItReturnsTo(TestNamespace ns) {
    User target = createRegularUser(ns, "undo");
    Impersonation impersonation = impersonating(ns, "undo", target);
    OpenMetadataClient direct = directClient(target);
    Glossary glossary = createGlossary(ns, "impundo");
    long since = System.currentTimeMillis();

    patchDescription(impersonation.viaBot(), glossary, "Written by the bot for the user");
    patchDescription(direct, glossary, "Rewritten by the user");
    patchDescription(direct, glossary, "Written by the bot for the user");

    assertEquals(
        List.of(
            new VersionAuthor(0.2, target.getName(), impersonation.bot()),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        glossaryVersionAuthors(glossary.getId()),
        "Undoing an edit in its session returns to the version before it, the bot included");
    assertEquals(
        Map.of(
            new EventAuthor(target.getName(), impersonation.bot()), 1L,
            new EventAuthor(target.getName(), null), 2L),
        descriptionEventAuthors(glossary, since, 3),
        "The user's own undo must be recorded as theirs, not as the bot's");
  }

  @Test
  void test_botUndoingItsEditInItsSession_isRecordedAsTheBots(TestNamespace ns) {
    User target = createRegularUser(ns, "botundo");
    Impersonation impersonation = impersonating(ns, "botundo", target);
    Glossary glossary = createGlossary(ns, "impbotundo");
    long since = System.currentTimeMillis();

    patchDescription(directClient(target), glossary, "Written by the user");
    patchDescription(impersonation.viaBot(), glossary, "Rewritten by the bot for the user");
    patchDescription(impersonation.viaBot(), glossary, "Written by the user");

    assertEquals(
        List.of(
            new VersionAuthor(0.2, target.getName(), null),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        glossaryVersionAuthors(glossary.getId()),
        "The bot undoing its edit in its session returns to the user's own version");
    assertEquals(
        Map.of(
            new EventAuthor(target.getName(), null), 1L,
            new EventAuthor(target.getName(), impersonation.bot()), 2L),
        descriptionEventAuthors(glossary, since, 3),
        "The bot's undo must be recorded as the bot's, not as the user's own");
  }

  @Test
  void test_adminDeleteAndRestore_afterAnImpersonatedEdit_nameNoBot(TestNamespace ns) {
    User target = createRegularUser(ns, "admdel");
    Impersonation impersonation = impersonating(ns, "admdel", target);
    Glossary glossary = createGlossary(ns, "impadmdel");
    patchDescription(impersonation.viaBot(), glossary, "Written by the bot for the user");

    SdkClients.adminClient().glossaries().delete(glossary.getId());
    SdkClients.adminClient().glossaries().restore(glossary.getId());

    assertEquals(
        List.of(
            new VersionAuthor(0.4, ADMIN_USER_NAME, null),
            new VersionAuthor(0.3, ADMIN_USER_NAME, null),
            new VersionAuthor(0.2, target.getName(), impersonation.bot()),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        glossaryVersionAuthors(glossary.getId()),
        "An admin's own delete and restore must not name the bot of the edit before them");
  }

  @Test
  void test_impersonatedDeleteAndRestore_nameTheBot(TestNamespace ns) {
    User owner = createRegularUser(ns, "botdel");
    Impersonation impersonation = impersonating(ns, "botdel", owner);
    Glossary glossary = createGlossaryOwnedBy(ns, "impbotdel", owner);
    patchDescription(directClient(owner), glossary, "Written by the user");

    impersonation.viaBot().glossaries().delete(glossary.getId());
    impersonation.viaBot().glossaries().restore(glossary.getId());

    assertEquals(
        List.of(
            new VersionAuthor(0.4, owner.getName(), impersonation.bot()),
            new VersionAuthor(0.3, owner.getName(), impersonation.bot()),
            new VersionAuthor(0.2, owner.getName(), null),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        glossaryVersionAuthors(glossary.getId()),
        "A delete and a restore the bot makes for its user must name the bot");
  }

  @Test
  void test_impersonatedAsyncDeleteAndRestore_nameTheBot(TestNamespace ns) {
    User owner = createRegularUser(ns, "asyncdel");
    Impersonation impersonation = impersonating(ns, "asyncdel", owner);
    Glossary glossary = createGlossaryOwnedBy(ns, "impasyncdel", owner);
    patchDescription(directClient(owner), glossary, "Written by the user");

    impersonation
        .viaBot()
        .getHttpClient()
        .executeForString(HttpMethod.DELETE, "/v1/glossaries/async/" + glossary.getId(), null);
    awaitGlossaryVersions(glossary.getId(), 3);
    impersonation
        .viaBot()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/glossaries/restore?async=true",
            Map.of("id", glossary.getId().toString()));
    awaitGlossaryVersions(glossary.getId(), 4);

    assertEquals(
        List.of(
            new VersionAuthor(0.4, owner.getName(), impersonation.bot()),
            new VersionAuthor(0.3, owner.getName(), impersonation.bot()),
            new VersionAuthor(0.2, owner.getName(), null),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        glossaryVersionAuthors(glossary.getId()),
        "The async delete and restore run off the request thread and must still name the bot");
  }

  @Test
  void test_adminRecursiveDeleteAndRestore_nameNoBotOnTheChildren(TestNamespace ns) {
    User target = createRegularUser(ns, "subtree");
    Impersonation impersonation = impersonating(ns, "subtree", target);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    Table table = SdkClients.adminClient().tables().create(tableRequest(ns, schema, "subtree"));
    impersonation
        .viaBot()
        .tables()
        .patch(table.getId().toString(), descriptionPatch("Written by the bot for the user"));

    SdkClients.adminClient()
        .databaseSchemas()
        .delete(schema.getId().toString(), Map.of("recursive", "true"));
    SdkClients.adminClient().databaseSchemas().restore(schema.getId());

    assertEquals(
        List.of(
            new VersionAuthor(0.4, ADMIN_USER_NAME, null),
            new VersionAuthor(0.3, ADMIN_USER_NAME, null),
            new VersionAuthor(0.2, target.getName(), impersonation.bot()),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        versionAuthors(SdkClients.adminClient().tables().getVersionList(table.getId())),
        "Deleting and restoring a schema must not credit its tables to the bot of their last edit");
  }

  @Test
  void test_impersonatedBulkRequest_namesTheBotOnWhatItCreatesAndUpdates(TestNamespace ns) {
    User admin = SdkClients.adminClient().users().getByName(ADMIN_USER_NAME);
    Impersonation impersonation = impersonating(ns, "bulk", admin);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    Table existing = SdkClients.adminClient().tables().create(tableRequest(ns, schema, "bulkold"));

    BulkOperationResult result =
        impersonation
            .viaBot()
            .tables()
            .bulkCreateOrUpdate(
                List.of(
                    tableRequest(ns, schema, "bulkold").withDescription("Written by the bot"),
                    tableRequest(ns, schema, "bulknew")));

    assertEquals(ApiStatus.SUCCESS, result.getStatus(), "Bulk request must succeed: " + result);
    Table created =
        SdkClients.adminClient()
            .tables()
            .getByName(schema.getFullyQualifiedName() + "." + ns.prefix("bulknew"));
    assertEquals(
        List.of(
            new VersionAuthor(0.2, ADMIN_USER_NAME, impersonation.bot()),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        versionAuthors(SdkClients.adminClient().tables().getVersionList(existing.getId())),
        "The table a bulk request updates for the user must name the bot");
    assertEquals(
        List.of(new VersionAuthor(0.1, ADMIN_USER_NAME, impersonation.bot())),
        versionAuthors(SdkClients.adminClient().tables().getVersionList(created.getId())),
        "The table a bulk request creates for the user must name the bot");
  }

  @Test
  void test_impersonatedCsvImport_namesTheBotNotTheImporter(TestNamespace ns) {
    User admin = SdkClients.adminClient().users().getByName(ADMIN_USER_NAME);
    Impersonation impersonation = impersonating(ns, "csv", admin);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    Table table =
        SdkClients.adminClient()
            .tables()
            .create(tableRequest(ns, schema, "csv").withDescription("Before the CSV import"));
    // An import of a single row writes no summary version on the schema; two rows do.
    SdkClients.adminClient().tables().create(tableRequest(ns, schema, "csvother"));
    String exported =
        SdkClients.adminClient().databaseSchemas().exportCsv(schema.getFullyQualifiedName());
    long since = System.currentTimeMillis();

    impersonation
        .viaBot()
        .databaseSchemas()
        .importCsv(
            schema.getFullyQualifiedName(),
            exported.replace("Before the CSV import", "Imported by the bot"),
            false,
            false);

    assertEquals(
        List.of(
            new VersionAuthor(0.2, ADMIN_USER_NAME, impersonation.bot()),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        versionAuthors(SdkClients.adminClient().tables().getVersionList(table.getId())),
        "A row the bot imports for its user must name the bot, not the user as their own bot");
    assertEquals(
        new VersionAuthor(0.2, ADMIN_USER_NAME, impersonation.bot()),
        versionAuthors(SdkClients.adminClient().databaseSchemas().getVersionList(schema.getId()))
            .getFirst(),
        "The import's summary version on the schema must name the bot");
    assertEquals(
        new EventAuthor(ADMIN_USER_NAME, impersonation.bot()),
        ChangeEventLog.awaitUpdateAuthor(
            Entity.DATABASE_SCHEMA, schema.getId(), EntityRepository.BULK_IMPORT, since),
        "The change event of the import's summary version must name the bot");
  }

  @Test
  void test_impersonatedPutUpdate_namesTheBot(TestNamespace ns) {
    User owner = createRegularUser(ns, "put");
    Impersonation impersonation = impersonating(ns, "put", owner);
    Glossary glossary = createGlossaryOwnedBy(ns, "impput", owner);

    impersonation
        .viaBot()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/glossaries",
            new CreateGlossary()
                .withName(glossary.getName())
                .withDescription("Rewritten by the bot for the user")
                .withOwners(List.of(owner.getEntityReference())),
            Glossary.class);

    assertEquals(
        List.of(
            new VersionAuthor(0.2, owner.getName(), impersonation.bot()),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        glossaryVersionAuthors(glossary.getId()),
        "A PUT the bot makes for its user must name the bot");
  }

  @Test
  void test_botDeleteThenAdminRestore_nameEachOneWhoWrote(TestNamespace ns) {
    User owner = createRegularUser(ns, "mixed");
    Impersonation impersonation = impersonating(ns, "mixed", owner);
    Glossary glossary = createGlossaryOwnedBy(ns, "impmixed", owner);
    patchDescription(directClient(owner), glossary, "Written by the user");

    impersonation.viaBot().glossaries().delete(glossary.getId());
    SdkClients.adminClient().glossaries().restore(glossary.getId());

    assertEquals(
        List.of(
            new VersionAuthor(0.4, ADMIN_USER_NAME, null),
            new VersionAuthor(0.3, owner.getName(), impersonation.bot()),
            new VersionAuthor(0.2, owner.getName(), null),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        glossaryVersionAuthors(glossary.getId()),
        "An admin's restore after the bot's delete must not name the bot");
  }

  @Test
  void test_impersonatedAsyncTermMove_namesTheBot(TestNamespace ns) {
    User admin = SdkClients.adminClient().users().getByName(ADMIN_USER_NAME);
    Impersonation impersonation = impersonating(ns, "move", admin);
    Glossary glossary = createGlossary(ns, "impmove");
    GlossaryTerm parent = createTerm(glossary, "parent");
    GlossaryTerm term = createTerm(glossary, "child");
    long since = System.currentTimeMillis();

    impersonation
        .viaBot()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/glossaryTerms/%s/moveAsync".formatted(term.getId()),
            new MoveGlossaryTermRequest().withParent(parent.getEntityReference()));

    // The term's approval workflow writes versions of its own, so the move is found by what it
    // changed rather than by its number.
    VersionAuthor move =
        Awaitility.await("the version the move wrote")
            .atMost(Duration.ofSeconds(60))
            .pollInterval(Duration.ofMillis(500))
            .until(
                () ->
                    versionChanging(
                        SdkClients.adminClient().glossaryTerms().getVersionList(term.getId()),
                        "parent"),
                Objects::nonNull);
    assertEquals(ADMIN_USER_NAME, move.updatedBy());
    assertEquals(
        impersonation.bot(),
        move.impersonatedBy(),
        "The async move runs off the request thread and must still name the bot");
    assertEquals(
        new EventAuthor(ADMIN_USER_NAME, impersonation.bot()),
        ChangeEventLog.awaitUpdateAuthor(Entity.GLOSSARY_TERM, term.getId(), "parent", since),
        "The change event of the async move must name the bot");
  }

  @Test
  void test_impersonatedColumnBulkUpdateAsync_namesTheBot(TestNamespace ns) {
    User admin = SdkClients.adminClient().users().getByName(ADMIN_USER_NAME);
    Impersonation impersonation = impersonating(ns, "colbulk", admin);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    Table table = SdkClients.adminClient().tables().create(tableRequest(ns, schema, "colbulk"));

    impersonation
        .viaBot()
        .getHttpClient()
        .executeForString(
            HttpMethod.POST,
            "/v1/columns/bulk-update-async",
            Map.of(
                "columnUpdates",
                List.of(
                    Map.of(
                        "columnFQN",
                        table.getFullyQualifiedName() + ".id",
                        "entityType",
                        Entity.TABLE,
                        "description",
                        "Written by the bot"))));

    awaitVersions(SdkClients.adminClient().tables(), table.getId(), 2);
    assertEquals(
        List.of(
            new VersionAuthor(0.2, ADMIN_USER_NAME, impersonation.bot()),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        versionAuthors(SdkClients.adminClient().tables().getVersionList(table.getId())),
        "The async column update runs off the request thread and must still name the bot");
  }

  @Test
  void test_impersonatedCreateMany_namesTheBot(TestNamespace ns) {
    User admin = SdkClients.adminClient().users().getByName(ADMIN_USER_NAME);
    Impersonation impersonation = impersonating(ns, "many", admin);
    Glossary glossary = createGlossary(ns, "impmany");

    impersonation
        .viaBot()
        .getHttpClient()
        .executeForString(
            HttpMethod.POST,
            "/v1/glossaryTerms/createMany",
            List.of(
                new CreateGlossaryTerm()
                    .withName("first")
                    .withGlossary(glossary.getFullyQualifiedName())
                    .withDescription("Created by the bot"),
                new CreateGlossaryTerm()
                    .withName("second")
                    .withGlossary(glossary.getFullyQualifiedName())
                    .withDescription("Created by the bot")));

    for (String name : List.of("first", "second")) {
      GlossaryTerm term =
          SdkClients.adminClient()
              .glossaryTerms()
              .getByName(glossary.getFullyQualifiedName() + "." + name);
      // The term's approval workflow may add versions of its own; the creation is v0.1.
      assertEquals(
          new VersionAuthor(0.1, ADMIN_USER_NAME, impersonation.bot()),
          versionAuthors(SdkClients.adminClient().glossaryTerms().getVersionList(term.getId()))
              .getLast(),
          "A term the bot creates in bulk for its user must name the bot");
    }
  }

  @Test
  void test_impersonatedDomainAssetsAdd_namesTheBotOnTheDomainEvent(TestNamespace ns) {
    User admin = SdkClients.adminClient().users().getByName(ADMIN_USER_NAME);
    Impersonation impersonation = impersonating(ns, "assets", admin);
    Domain domain = createDomain(ns, "impassets");
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    Table table = SdkClients.adminClient().tables().create(tableRequest(ns, schema, "asset"));
    long since = System.currentTimeMillis();

    impersonation
        .viaBot()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/domains/%s/assets/add".formatted(domain.getFullyQualifiedName()),
            new BulkAssets().withAssets(List.of(table.getEntityReference())),
            BulkOperationResult.class);

    assertEquals(
        new EventAuthor(ADMIN_USER_NAME, impersonation.bot()),
        ChangeEventLog.awaitUpdateAuthor(Entity.DOMAIN, domain.getId(), "assets", since),
        "The domain's change event for the assets the bot added must name the bot");
  }

  @Test
  void test_impersonatedPortEdit_keepsDistinctVersionAuthors(TestNamespace ns) {
    User admin = SdkClients.adminClient().users().getByName(ADMIN_USER_NAME);
    Impersonation impersonation = impersonating(ns, "ports", admin);
    Domain domain = createDomain(ns, "impports");
    DataProduct dataProduct =
        SdkClients.adminClient()
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(ns.prefix("impportsdp"))
                    .withDescription("Written by admin")
                    .withDomains(List.of(domain.getFullyQualifiedName())));
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    Table table = SdkClients.adminClient().tables().create(tableRequest(ns, schema, "port"));
    BulkAssets port = new BulkAssets().withAssets(List.of(table.getEntityReference()));
    long since = System.currentTimeMillis();

    impersonation.viaBot().dataProducts().inputPorts(dataProduct.getFullyQualifiedName()).add(port);

    DataProduct written =
        SdkClients.adminClient().dataProducts().get(dataProduct.getId().toString());
    assertEquals(ADMIN_USER_NAME, written.getUpdatedBy());
    assertEquals(
        impersonation.bot(),
        written.getImpersonatedBy(),
        "The data product the bot linked an input port to must name the bot");
    assertEquals(
        new EventAuthor(ADMIN_USER_NAME, impersonation.bot()),
        ChangeEventLog.awaitUpdateAuthor(
            Entity.DATA_PRODUCT, dataProduct.getId(), "inputPorts", since),
        "The change event of the input port the bot added must name the bot");

    impersonation.viaBot().dataProducts().inputPorts(dataProduct.getFullyQualifiedName()).add(port);
    SdkClients.adminClient()
        .dataProducts()
        .inputPorts(dataProduct.getFullyQualifiedName())
        .remove(port);
    SdkClients.adminClient()
        .dataProducts()
        .patch(dataProduct.getId().toString(), descriptionPatch("Edited after removing the port"));

    assertEquals(
        List.of(
            new VersionAuthor(0.4, ADMIN_USER_NAME, null),
            new VersionAuthor(0.3, ADMIN_USER_NAME, null),
            new VersionAuthor(0.2, ADMIN_USER_NAME, impersonation.bot()),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        versionAuthors(SdkClients.adminClient().dataProducts().getVersionList(dataProduct.getId())),
        "A retry adds no version, and a later field edit preserves both port versions");
  }

  @Test
  void test_impersonatedFollow_namesTheBotOnTheEvent(TestNamespace ns) {
    User admin = SdkClients.adminClient().users().getByName(ADMIN_USER_NAME);
    Impersonation impersonation = impersonating(ns, "follow", admin);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    Table table = SdkClients.adminClient().tables().create(tableRequest(ns, schema, "follow"));
    long since = System.currentTimeMillis();

    impersonation
        .viaBot()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/tables/%s/followers".formatted(table.getId()), admin.getId());

    assertEquals(
        new EventAuthor(ADMIN_USER_NAME, impersonation.bot()),
        ChangeEventLog.awaitUpdateAuthor(
            Entity.TABLE, table.getId(), Entity.FIELD_FOLLOWERS, since),
        "A follow the bot makes for its user must be recorded with the bot");
  }

  @Test
  void test_impersonatedHardDelete_namesTheBotOnTheEvent(TestNamespace ns) {
    User admin = SdkClients.adminClient().users().getByName(ADMIN_USER_NAME);
    Impersonation impersonation = impersonating(ns, "harddel", admin);
    Glossary glossary = createGlossary(ns, "impharddel");
    // A hard delete's event is dated at the entity's last update, which is this edit.
    long since = System.currentTimeMillis();
    patchDescription(SdkClients.adminClient(), glossary, "Written by admin directly");

    JsonNode deleted =
        JsonUtils.readTree(
            impersonation
                .viaBot()
                .getHttpClient()
                .executeForString(
                    HttpMethod.DELETE,
                    "/v1/glossaries/%s?hardDelete=true".formatted(glossary.getId()),
                    null));

    VersionAuthor deleter = author(deleted);
    assertEquals(ADMIN_USER_NAME, deleter.updatedBy());
    assertEquals(
        impersonation.bot(),
        deleter.impersonatedBy(),
        "The hard-deleted entity the response carries must name the bot that deleted it");
    assertEquals(
        new EventAuthor(ADMIN_USER_NAME, impersonation.bot()),
        ChangeEventLog.awaitHardDeleteAuthor(Entity.GLOSSARY, glossary.getId(), since),
        "A hard delete the bot makes must be recorded with the bot");
  }

  @Test
  void test_adminAsyncHardDelete_afterAnImpersonatedEdit_namesNoBot(TestNamespace ns) {
    User target = createRegularUser(ns, "asyncharddel");
    Impersonation impersonation = impersonating(ns, "asyncharddel", target);
    Glossary glossary = createGlossary(ns, "impasyncharddel");
    // A hard delete's event is dated at the entity's last update, which is this edit.
    long since = System.currentTimeMillis();
    patchDescription(impersonation.viaBot(), glossary, "Written by the bot for the user");

    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/glossaries/async/%s?hardDelete=true".formatted(glossary.getId()),
            null);

    assertEquals(
        new EventAuthor(ADMIN_USER_NAME, null),
        ChangeEventLog.awaitHardDeleteAuthor(Entity.GLOSSARY, glossary.getId(), since),
        "An admin's async hard delete must not be recorded with the bot of the edit before it");
  }

  @Test
  void test_editUndoneInItsSession_throughTheColumnEditor_isRecordedAsTheUsers(TestNamespace ns) {
    User target = createRegularUser(ns, "colundo");
    Impersonation impersonation = impersonating(ns, "colundo", target);
    OpenMetadataClient direct = directClient(target);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    Table table = SdkClients.adminClient().tables().create(tableRequest(ns, schema, "colundo"));
    String column = table.getFullyQualifiedName() + ".id";
    long since = System.currentTimeMillis();

    putColumnDescription(impersonation.viaBot(), column, "Written by the bot for the user");
    putColumnDescription(direct, column, "Rewritten by the user");
    putColumnDescription(direct, column, "Written by the bot for the user");

    assertEquals(
        List.of(
            new VersionAuthor(0.2, target.getName(), impersonation.bot()),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        versionAuthors(SdkClients.adminClient().tables().getVersionList(table.getId())),
        "Undoing a column edit in its session returns to the version before it, the bot included");
    assertEquals(
        Map.of(
            new EventAuthor(target.getName(), impersonation.bot()), 1L,
            new EventAuthor(target.getName(), null), 2L),
        countByAuthor(
            ChangeEventLog.awaitUpdateAuthors(
                Entity.TABLE, table.getId(), "columns.id.description", since, 3)),
        "The user's own undo through the column editor must be recorded as theirs");
  }

  @Test
  void test_impersonatedTaskApproval_namesTheBotOnTheChangeItApplies(TestNamespace ns) {
    User owner = createRegularUser(ns, "task");
    Impersonation impersonation = impersonating(ns, "task", owner);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    Table table =
        SdkClients.adminClient()
            .tables()
            .create(
                tableRequest(ns, schema, "task").withOwners(List.of(owner.getEntityReference())));
    Task task =
        SdkClients.adminClient()
            .tasks()
            .create(
                new CreateTask()
                    .withName(ns.prefix("impdesc"))
                    .withDescription("Describe the table")
                    .withCategory(TaskCategory.MetadataUpdate)
                    .withType(TaskEntityType.DescriptionUpdate)
                    .withAbout("<#E::table::%s>".formatted(table.getFullyQualifiedName()))
                    .withPayload(
                        new DescriptionUpdatePayload()
                            .withFieldPath("description")
                            .withCurrentDescription(table.getDescription())
                            .withNewDescription("Approved by the bot for the owner")));
    awaitTaskReadyForResolution(task.getId());
    long since = System.currentTimeMillis();

    impersonation
        .viaBot()
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask()
                .withResolutionType(TaskResolutionType.Approved)
                .withNewValue("Approved by the bot for the owner"));

    VersionAuthor applied =
        Awaitility.await("the version the approved task wrote")
            .atMost(Duration.ofSeconds(60))
            .pollInterval(Duration.ofMillis(500))
            .until(
                () ->
                    versionChanging(
                        SdkClients.adminClient().tables().getVersionList(table.getId()),
                        "description"),
                Objects::nonNull);
    assertEquals(owner.getName(), applied.updatedBy());
    assertEquals(
        impersonation.bot(),
        applied.impersonatedBy(),
        "The change a bot approves for the task's assignee must name the bot");
    assertEquals(
        new EventAuthor(owner.getName(), impersonation.bot()),
        ChangeEventLog.awaitUpdateAuthor(Entity.TABLE, table.getId(), "description", since),
        "The change event of the approved task must name the bot");
  }

  @Test
  void test_impersonatedLineageAdd_namesTheBotOnTheAuditRow(TestNamespace ns) {
    User admin = SdkClients.adminClient().users().getByName(ADMIN_USER_NAME);
    Impersonation impersonation = impersonating(ns, "lineage", admin);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    Table upstream = SdkClients.adminClient().tables().create(tableRequest(ns, schema, "up"));
    Table downstream = SdkClients.adminClient().tables().create(tableRequest(ns, schema, "down"));

    impersonation
        .viaBot()
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(upstream.getEntityReference())
                        .withToEntity(downstream.getEntityReference())));

    assertEquals(
        new EventAuthor(ADMIN_USER_NAME, impersonation.bot()),
        ChangeEventLog.awaitAuditAuthor(
            upstream.getFullyQualifiedName()
                + LINEAGE_EDGE_DELIMITER
                + downstream.getFullyQualifiedName(),
            EventType.ENTITY_LINEAGE_ADDED.value()),
        "The audit row of a lineage edge the bot adds must name the bot");
  }

  @Test
  void test_impersonatedColumnCsvImportAsync_namesTheBot(TestNamespace ns) {
    User admin = SdkClients.adminClient().users().getByName(ADMIN_USER_NAME);
    Impersonation impersonation = impersonating(ns, "colcsv", admin);
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = SdkClients.adminClient().tables().create(tableRequest(ns, schema, "colcsv"));

    impersonation
        .viaBot()
        .getHttpClient()
        .executeForString(
            HttpMethod.POST,
            "/v1/columns/import-async",
            "column,displayName,description,tags,glossaryTerms\nid,,Written by the bot,,\n",
            RequestOptions.builder()
                .header("Content-Type", "text/plain; charset=UTF-8")
                .queryParam("serviceName", service.getName())
                .build());

    awaitVersions(SdkClients.adminClient().tables(), table.getId(), 2);
    assertEquals(
        List.of(
            new VersionAuthor(0.2, ADMIN_USER_NAME, impersonation.bot()),
            new VersionAuthor(0.1, ADMIN_USER_NAME, null)),
        versionAuthors(SdkClients.adminClient().tables().getVersionList(table.getId())),
        "The async column CSV import runs off the request thread and must still name the bot");
  }

  @Test
  @ResourceLock("MULTI_DOMAIN_RULE")
  void test_impersonatedDomainHardDelete_namesTheBotOnTheDetachedDataProduct(TestNamespace ns) {
    User admin = SdkClients.adminClient().users().getByName(ADMIN_USER_NAME);
    Impersonation impersonation = impersonating(ns, "detach", admin);
    Domain deleted = createDomain(ns, "impdetachgone");
    Domain kept = createDomain(ns, "impdetachkept");
    DataProduct dataProduct = dataProductInDomains(ns, "impdetachdp", deleted, kept);
    long since = System.currentTimeMillis();

    impersonation
        .viaBot()
        .domains()
        .delete(deleted.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    VersionAuthor detach =
        versionAuthors(SdkClients.adminClient().dataProducts().getVersionList(dataProduct.getId()))
            .getFirst();
    assertEquals(ADMIN_USER_NAME, detach.updatedBy());
    assertEquals(
        impersonation.bot(),
        detach.impersonatedBy(),
        "Detaching a data product from the domain the bot deleted must name the bot");
    assertEquals(
        new EventAuthor(ADMIN_USER_NAME, impersonation.bot()),
        ChangeEventLog.awaitUpdateAuthor(
            Entity.DATA_PRODUCT, dataProduct.getId(), Entity.FIELD_DOMAINS, since),
        "The change event of the detach must name the bot");
  }

  // How LineageRepository names an edge in its change event's FQN.
  private static final String LINEAGE_EDGE_DELIMITER = "--upstream-->";

  private record IdentityCall(HttpMethod method, String path, Object body) {}

  private record VersionAuthor(double version, String updatedBy, String impersonatedBy) {}

  /** A bot allowed to impersonate {@code target}, and a client that writes as the target through it. */
  private record Impersonation(String bot, OpenMetadataClient viaBot) {}

  private Impersonation impersonating(TestNamespace ns, String suffix, User target) {
    User botUser = createBotUser(ns, suffix);
    createBot(ns.prefix("imp_" + suffix + "_bot"), botUser, true);
    return new Impersonation(
        botUser.getName(), impersonationClient(generateBotToken(botUser), target.getName()));
  }

  private static OpenMetadataClient directClient(User user) {
    return SdkClients.createClient(user.getName(), user.getEmail(), new String[] {});
  }

  private static Glossary createGlossary(TestNamespace ns, String name) {
    return createGlossary(ns, new CreateGlossary().withName(ns.prefix(name)));
  }

  /** Owners may delete and restore what they own, which a Data Consumer otherwise may not. */
  private static Glossary createGlossaryOwnedBy(TestNamespace ns, String name, User owner) {
    return createGlossary(
        ns,
        new CreateGlossary()
            .withName(ns.prefix(name))
            .withOwners(List.of(owner.getEntityReference())));
  }

  private static Glossary createGlossary(TestNamespace ns, CreateGlossary request) {
    return ns.trackRoot(
        Entity.GLOSSARY,
        SdkClients.adminClient().glossaries().create(request.withDescription("Written by admin")));
  }

  private static Domain createDomain(TestNamespace ns, String name) {
    return ns.trackRoot(
        Entity.DOMAIN,
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix(name))
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Written by admin")));
  }

  /** A data product in every one of {@code domains}, which the multi-domain rule otherwise forbids. */
  private static DataProduct dataProductInDomains(
      TestNamespace ns, String name, Domain... domains) {
    OpenMetadataClient admin = SdkClients.adminClient();
    DataProduct created =
        admin
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(ns.prefix(name))
                    .withDescription("Written by admin")
                    .withDomains(List.of(domains[0].getFullyQualifiedName())));
    boolean ruleWasEnabled = EntityRulesUtil.isMultiDomainRuleEnabled(admin);
    EntityRulesUtil.toggleMultiDomainRule(admin, false);
    try {
      DataProduct update = admin.dataProducts().get(created.getId().toString(), "domains");
      update.setDomains(Stream.of(domains).map(Domain::getEntityReference).toList());
      return admin.dataProducts().update(created.getId().toString(), update);
    } finally {
      EntityRulesUtil.toggleMultiDomainRule(admin, ruleWasEnabled);
    }
  }

  /** How many of the glossary's description change events since {@code since} name each author. */
  private static Map<EventAuthor, Long> descriptionEventAuthors(
      Glossary glossary, long since, int count) {
    return countByAuthor(
        ChangeEventLog.awaitUpdateAuthors(
            Entity.GLOSSARY, glossary.getId(), "description", since, count));
  }

  // Events are recorded off the request thread, so their order is not the requests' order.
  private static Map<EventAuthor, Long> countByAuthor(List<EventAuthor> authors) {
    return authors.stream()
        .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
  }

  private static void putColumnDescription(
      OpenMetadataClient client, String columnFqn, String description) {
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/columns/name/%s?entityType=%s"
                .formatted(UriTestUtils.encodeURIComponent(columnFqn), Entity.TABLE),
            JsonUtils.pojoToJson(Map.of("description", description)));
  }

  /** Waits for the task's workflow to reach the step a resolution completes. */
  private static void awaitTaskReadyForResolution(UUID taskId) {
    Awaitility.await("task " + taskId + " ready for resolution")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(250))
        .until(
            () ->
                WorkflowHandler.getInstance().hasActiveRuntimeTask(taskId)
                    && !nullOrEmpty(
                        SdkClients.adminClient()
                            .tasks()
                            .get(taskId.toString(), "availableTransitions")
                            .getAvailableTransitions()));
  }

  private static CreateTable tableRequest(TestNamespace ns, DatabaseSchema schema, String name) {
    return new CreateTable()
        .withName(ns.prefix(name))
        .withDatabaseSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(ColumnBuilder.of("id", "BIGINT").build()));
  }

  private static JsonNode descriptionPatch(String description) {
    return JsonUtils.readTree(
        "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"%s\"}]".formatted(description));
  }

  private static void patchDescription(
      OpenMetadataClient client, Glossary glossary, String description) {
    client.glossaries().patch(glossary.getId().toString(), descriptionPatch(description));
  }

  private static void awaitGlossaryVersions(UUID glossaryId, int count) {
    Awaitility.await("glossary " + glossaryId + " reaches " + count + " versions")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofMillis(500))
        .until(() -> glossaryVersionAuthors(glossaryId).size() >= count);
  }

  private static void awaitVersions(EntityServiceBase<?> service, UUID entityId, int count) {
    Awaitility.await("entity " + entityId + " reaches " + count + " versions")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofMillis(500))
        .until(() -> versionAuthors(service.getVersionList(entityId)).size() >= count);
  }

  private static List<VersionAuthor> glossaryVersionAuthors(UUID glossaryId) {
    return versionAuthors(SdkClients.adminClient().glossaries().getVersionList(glossaryId));
  }

  private static List<VersionAuthor> versionAuthors(EntityHistory history) {
    return versions(history).map(BotImpersonationIT::author).toList();
  }

  /** The newest version whose change set touches {@code field}, or null while there is none. */
  private static VersionAuthor versionChanging(EntityHistory history, String field) {
    return versions(history)
        .filter(version -> changes(version.path("changeDescription"), field))
        .findFirst()
        .map(BotImpersonationIT::author)
        .orElse(null);
  }

  private static boolean changes(JsonNode changeDescription, String field) {
    return Stream.of("fieldsAdded", "fieldsUpdated")
        .flatMap(kind -> StreamSupport.stream(changeDescription.path(kind).spliterator(), false))
        .anyMatch(change -> field.equals(change.path("name").asText()));
  }

  private static Stream<JsonNode> versions(EntityHistory history) {
    return history.getVersions().stream()
        .map(
            version ->
                version instanceof String json
                    ? JsonUtils.readTree(json)
                    : JsonUtils.valueToTree(version));
  }

  private static VersionAuthor author(JsonNode version) {
    return new VersionAuthor(
        version.get("version").asDouble(),
        version.get("updatedBy").asText(),
        version.hasNonNull("impersonatedBy") ? version.get("impersonatedBy").asText() : null);
  }

  private static GlossaryTerm createTerm(Glossary glossary, String name) {
    return SdkClients.adminClient()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription("Written by admin"));
  }

  private OpenMetadataClient grantedBotImpersonating(
      TestNamespace ns, String suffix, String targetUserName) {
    User botUser = createBotUser(ns, suffix);
    createBot(ns.prefix("imp_" + suffix + "_bot"), botUser, true);
    return impersonationClient(generateBotToken(botUser), targetUserName);
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
    return createRegularUser(ns, suffix, null);
  }

  private User createRegularUser(TestNamespace ns, String suffix, String domainFqn) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String userName = ns.prefix("imptarget_" + suffix + "_" + uniqueId);
    Role dataConsumer = SdkClients.adminClient().roles().getByName("DataConsumer");

    CreateUser request =
        new CreateUser()
            .withName(userName)
            .withEmail("imptarget" + suffix + uniqueId + "@test.com")
            .withDescription("Impersonation target user")
            .withRoles(List.of(dataConsumer.getId()));
    if (domainFqn != null) {
      request.withDomains(List.of(domainFqn));
    }

    return SdkClients.adminClient().users().create(request);
  }

  private Role createDomainScopedImpersonationRole(TestNamespace ns) {
    Rule allowWithinDomain =
        new Rule()
            .withName("AllowImpersonationWithinDomain")
            .withResources(List.of(Entity.USER))
            .withOperations(List.of(MetadataOperation.IMPERSONATE))
            .withEffect(Rule.Effect.ALLOW)
            .withCondition("hasDomain()");
    Policy policy =
        SdkClients.adminClient()
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.shortPrefix("impdompol"))
                    .withRules(List.of(allowWithinDomain)));
    return SdkClients.adminClient()
        .roles()
        .create(
            new CreateRole()
                .withName(ns.shortPrefix("impdomrole"))
                .withPolicies(List.of(policy.getFullyQualifiedName())));
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
