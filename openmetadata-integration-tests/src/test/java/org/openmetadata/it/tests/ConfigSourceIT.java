/*
 *  Copyright 2026 Collate
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.settings.SettingsType.APP_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.MCP_CONFIGURATION;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.configuration.ConfigSourceConfiguration;
import org.openmetadata.schema.configuration.ConfigSourceMode;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ConflictException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.source.ConfigSources;
import org.openmetadata.service.config.source.DeploymentConfig;
import org.openmetadata.service.config.source.DeploymentConfigReconciler;
import org.openmetadata.service.config.source.DeploymentSetting;
import org.openmetadata.service.config.source.DeploymentTemplate;
import org.openmetadata.service.config.source.DualSourceSetting;
import org.openmetadata.service.config.source.SettingsChangeWatcher;
import org.openmetadata.service.config.source.SettingsSecrets;
import org.openmetadata.service.config.source.StoredSettingRow;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * Precedence between the deployment configuration and the stored security settings (#31786,
 * collate#4484, #30882), against the real server and database. A restart is replayed by running
 * the start-up reconciliation with a crafted deployment configuration.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
public class ConfigSourceIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String SECURITY_CONFIG_PATH = "/v1/system/security/config";
  private static final String SECURITY_VALIDATE_PATH = "/v1/system/security/validate";
  private static final String MCP_CONFIG_PATH = "/v1/system/mcp/config";
  private static final String SETTINGS_PATH = "/v1/system/settings";
  private static final String SETTINGS_SOURCE_PATH = SETTINGS_PATH + "/source";
  private static final String AUTH = AUTHENTICATION_CONFIGURATION.value();
  private static final String AUTHORIZER = AUTHORIZER_CONFIGURATION.value();
  private static final DeploymentTemplate TEMPLATE =
      DeploymentTemplate.parse(
          """
          authenticationConfiguration:
            maxActiveSessionsPerUser: ${AUTHENTICATION_MAX_ACTIVE_SESSIONS_PER_USER:-5}
            enableSelfSignup: ${AUTHENTICATION_ENABLE_SELF_SIGNUP:-false}
          """,
          "/authenticationConfiguration");

  private SystemDAO dao;
  private StoredSettingRow originalRow;
  private StoredSettingRow originalAuthorizerRow;
  private Optional<DeploymentConfig> originalDeployment;

  @BeforeEach
  void rememberStoredState() {
    dao = Entity.getCollectionDAO().systemDAO();
    originalRow = dao.getStoredSettingRow(AUTH);
    originalAuthorizerRow = dao.getStoredSettingRow(AUTHORIZER);
    originalDeployment = ConfigSources.deployment();
  }

  @AfterEach
  void restoreStoredState() {
    dao.insertSettings(AUTH, originalRow.json());
    dao.updateDeploymentSnapshot(AUTH, originalRow.snapshot());
    dao.insertSettings(AUTHORIZER, originalAuthorizerRow.json());
    SettingsCache.invalidateSettings(AUTHORIZER);
    ConfigSources.install(originalDeployment.orElse(null));
    reloadSecurity();
  }

  @Test
  void deploymentChangesApplyWhileUiChangesSurviveThem() throws Exception {
    clearSnapshot();
    restart(storedAuthentication());
    restart(storedWith(5000, true));
    assertEquals(
        5000,
        currentSecurity().at("/authenticationConfiguration/maxActiveSessionsPerUser").asInt());

    saveInUi("enableSelfSignup", false);
    restart(storedWith(6000, true));

    JsonNode authentication = currentSecurity().get("authenticationConfiguration");
    assertEquals(6000, authentication.get("maxActiveSessionsPerUser").asInt());
    assertFalse(authentication.get("enableSelfSignup").asBoolean());
  }

  @Test
  void reportsDeploymentValuesTheUiOverridesAndAdoptsThemOnRequest() throws Exception {
    clearSnapshot();
    restart(storedAuthentication());
    restart(storedWith(5000, true));
    saveInUi("enableSelfSignup", false);
    restart(storedWith(5000, true));

    JsonNode source = authenticationSource();
    assertTrue(source.toString().contains("/enableSelfSignup"), source.toString());
    assertTrue(source.toString().contains("AUTHENTICATION_ENABLE_SELF_SIGNUP"));

    execute(
        HttpMethod.POST,
        SETTINGS_SOURCE_PATH + "/" + AUTH + "/adopt",
        "{\"paths\":[\"/enableSelfSignup\"]}");

    assertTrue(currentSecurity().at("/authenticationConfiguration/enableSelfSignup").asBoolean());
  }

  @Test
  void envModeRejectsChangesToFieldsTheDeploymentOwns() throws Exception {
    clearSnapshot();
    restart(storedAuthentication());
    restart(storedWith(5000, true));
    try (AutoCloseable env =
        ConfigSources.overrideForTest(AUTHENTICATION_CONFIGURATION, ConfigSourceMode.ENV)) {
      ConflictException patchRejected =
          assertThrows(
              ConflictException.class,
              () ->
                  patchSecurity(
                      "replace", "/authenticationConfiguration/maxActiveSessionsPerUser", 4242));
      ConflictException putRejected =
          assertThrows(ConflictException.class, () -> saveInUi("maxActiveSessionsPerUser", 4242));
      assertEquals(409, patchRejected.getStatusCode());
      assertEquals(409, putRejected.getStatusCode());
    }
    assertEquals(5000, storedAuthentication().get("maxActiveSessionsPerUser").asInt());
  }

  @Test
  void envModeRejectsChangesThroughTheGenericSettingsEndpoint() throws Exception {
    String stored = dao.getConfigJsonWithKey(APP_CONFIGURATION.value());
    String otherMode = stored != null && stored.contains("\"ai\"") ? "classic" : "ai";
    String update =
        MAPPER.writeValueAsString(
            Map.of(
                "config_type",
                APP_CONFIGURATION.value(),
                "config_value",
                Map.of("defaultAppMode", otherMode)));
    try (AutoCloseable env =
        ConfigSources.overrideForTest(APP_CONFIGURATION, ConfigSourceMode.ENV)) {
      ConflictException rejected =
          assertThrows(
              ConflictException.class, () -> execute(HttpMethod.PUT, SETTINGS_PATH, update));
      assertEquals(409, rejected.getStatusCode());
    }
    assertEquals(stored, dao.getConfigJsonWithKey(APP_CONFIGURATION.value()));
  }

  /**
   * Another server's start applies that server's deployment configuration to itself only; what an
   * admin saves on another server, including undoing a change, applies here without a restart.
   */
  @Test
  void followsChangesSavedOnAnotherServerButNotItsStartup() {
    SettingsChangeWatcher watcher =
        TestSuiteBootstrap.findManagedObject(SettingsChangeWatcher.class).orElseThrow();
    clearSnapshot();
    restart(storedAuthentication());
    watcher.pollNow();
    int running = runningMaxActiveSessionsPerUser();

    reconcile(storedWith(running + 123, true));
    String writtenByStartup = dao.getConfigJsonWithKey(AUTH);
    watcher.pollNow();
    assertEquals(running, runningMaxActiveSessionsPerUser());

    ObjectNode changed = storedAuthentication();
    changed.put("maxActiveSessionsPerUser", 7000);
    store(changed);
    watcher.pollNow();
    assertEquals(7000, runningMaxActiveSessionsPerUser());

    dao.insertSettings(AUTH, writtenByStartup);
    watcher.pollNow();
    assertEquals(running + 123, runningMaxActiveSessionsPerUser());
  }

  @Test
  void storesAuthenticationSecretsEncryptedAndNeverReturnsThem() throws Exception {
    ObjectNode security = (ObjectNode) currentSecurity();
    ObjectNode ldap =
        ((ObjectNode) security.get("authenticationConfiguration")).putObject("ldapConfiguration");
    ldap.put("host", "ldap.example.invalid");
    ldap.put("port", 636);
    ldap.put("dnAdminPrincipal", "cn=admin,dc=example,dc=com");
    ldap.put("dnAdminPassword", "bind-s3cret");
    execute(HttpMethod.PUT, SECURITY_CONFIG_PATH, security.toString());

    String storedPassword =
        JsonUtils.readTree(dao.getConfigJsonWithKey(AUTH))
            .at("/ldapConfiguration/dnAdminPassword")
            .asText();
    assertTrue(!Fernet.getInstance().isKeyDefined() || Fernet.isTokenized(storedPassword));
    assertEquals(
        "*********",
        currentSecurity()
            .at("/authenticationConfiguration/ldapConfiguration/dnAdminPassword")
            .asText());
  }

  /**
   * collate#4484: a version that predates {@code maxActiveSessionsPerUser} stored the setting
   * without it, or with the schema default; the upgrade start applies the deployment value.
   */
  @Test
  void upgradeAppliesADeploymentValueTheStoredSettingNeverChose() {
    for (Integer storedValue : Arrays.asList(null, 5)) {
      ObjectNode stored = storedAuthentication();
      stored.remove("maxActiveSessionsPerUser");
      if (storedValue != null) {
        stored.put("maxActiveSessionsPerUser", storedValue);
      }
      store(stored);
      clearSnapshot();

      restart(storedWith(1000, stored.path("enableSelfSignup").asBoolean()));

      assertEquals(1000, runningMaxActiveSessionsPerUser(), "stored " + storedValue);
    }
  }

  @Test
  void aBlankDeploymentValueKeepsTheStoredValue() {
    DeploymentTemplate template =
        DeploymentTemplate.parse(
            """
            authenticationConfiguration:
              jwtTeamClaimMapping: ${AUTHENTICATION_JWT_TEAM_CLAIM_MAPPING:-""}
            """,
            "/authenticationConfiguration");
    ObjectNode stored = storedAuthentication();
    stored.put("jwtTeamClaimMapping", "groups");
    store(stored);
    clearSnapshot();
    ObjectNode deployment = stored.deepCopy();
    deployment.put("jwtTeamClaimMapping", "");

    reconcile(deployment, template);

    assertEquals("groups", storedAuthentication().path("jwtTeamClaimMapping").asText());
  }

  /**
   * The deployment sets only the session cap on purpose. "Use deployment value" without fields must
   * take just that, and keep the values the deployment leaves at their defaults as saved in the UI.
   */
  @Test
  void adoptWithoutFieldsTakesOnlyTheOverriddenOnes() throws Exception {
    DeploymentTemplate template =
        DeploymentTemplate.parse(
            """
            authenticationConfiguration:
              clientId: ${AUTHENTICATION_CLIENT_ID:-""}
              enableSelfSignup: ${AUTHENTICATION_ENABLE_SELF_SIGNUP:-false}
              maxActiveSessionsPerUser: ${AUTHENTICATION_MAX_ACTIVE_SESSIONS_PER_USER:-5}
            """,
            "/authenticationConfiguration");
    ObjectNode stored = storedAuthentication();
    stored.put("clientId", "ui-client");
    stored.put("enableSelfSignup", true);
    stored.put("maxActiveSessionsPerUser", 4000);
    store(stored);
    ObjectNode deployment = stored.deepCopy();
    deployment.put("clientId", "");
    deployment.put("enableSelfSignup", false);
    deployment.put("maxActiveSessionsPerUser", 1000);
    installDeployment(deployment, template);

    JsonNode overridden = authenticationSource().get("overriddenFields");
    assertEquals(1, overridden.size(), overridden.toString());
    assertEquals("/maxActiveSessionsPerUser", overridden.get(0).get("path").asText());

    execute(HttpMethod.POST, SETTINGS_SOURCE_PATH + "/" + AUTH + "/adopt", "{}");

    JsonNode adopted = storedAuthentication();
    assertEquals(1000, adopted.path("maxActiveSessionsPerUser").asInt());
    assertEquals("ui-client", adopted.path("clientId").asText());
    assertTrue(adopted.path("enableSelfSignup").asBoolean());
  }

  /** "Use deployment value" on the admins restores the deployment's and never revokes the UI's. */
  @Test
  void adoptingTheAdminsKeepsThoseAddedInTheUi() throws Exception {
    ObjectNode stored = (ObjectNode) JsonUtils.readTree(originalAuthorizerRow.json());
    stored.putArray("adminPrincipals").add("admin").add("ui-admin");
    dao.insertSettings(AUTHORIZER, stored.toString());
    SettingsCache.invalidateSettings(AUTHORIZER);
    ObjectNode deployment = stored.deepCopy();
    deployment.putArray("adminPrincipals").add("admin").add("deployment-admin");
    installAuthorizerDeployment(deployment);

    execute(HttpMethod.POST, SETTINGS_SOURCE_PATH + "/" + AUTHORIZER + "/adopt", "{}");

    JsonNode admins =
        JsonUtils.readTree(dao.getConfigJsonWithKey(AUTHORIZER)).get("adminPrincipals");
    Set<String> adminNames = new HashSet<>();
    admins.forEach(admin -> adminNames.add(admin.asText()));
    assertEquals(Set.of("admin", "ui-admin", "deployment-admin"), adminNames);
  }

  @Test
  void onlyAdminsSeeOrAdoptSettingSources() {
    OpenMetadataClient nonAdmin = SdkClients.user1Client();
    OpenMetadataException read =
        assertThrows(
            OpenMetadataException.class,
            () -> execute(nonAdmin, HttpMethod.GET, SETTINGS_SOURCE_PATH, null));
    OpenMetadataException adopt =
        assertThrows(
            OpenMetadataException.class,
            () ->
                execute(
                    nonAdmin,
                    HttpMethod.POST,
                    SETTINGS_SOURCE_PATH + "/" + AUTH + "/adopt",
                    "{\"paths\":[]}"));

    assertEquals(403, read.getStatusCode());
    assertEquals(403, adopt.getStatusCode());
  }

  /** ENV mode guards writes only: an admin can still test a configuration before saving it. */
  @Test
  void envModeStillValidatesASecurityConfiguration() throws Exception {
    clearSnapshot();
    restart(storedAuthentication());
    ObjectNode security = (ObjectNode) currentSecurity();
    ((ObjectNode) security.get("authenticationConfiguration"))
        .put("maxActiveSessionsPerUser", 4242);
    try (AutoCloseable env =
        ConfigSources.overrideForTest(AUTHENTICATION_CONFIGURATION, ConfigSourceMode.ENV)) {
      JsonNode validation =
          MAPPER.readTree(execute(HttpMethod.POST, SECURITY_VALIDATE_PATH, security.toString()));

      assertTrue(validation.has("status"), validation.toString());
    }
  }

  @Test
  void envModeRejectsMcpChangesToFieldsTheDeploymentOwns() throws Exception {
    String storedMcp = dao.getConfigJsonWithKey(MCP_CONFIGURATION.value());
    ObjectNode update =
        storedMcp == null ? MAPPER.createObjectNode() : (ObjectNode) MAPPER.readTree(storedMcp);
    int connectTimeout = update.path("connectTimeout").asInt(30) + 17;
    update.put("connectTimeout", connectTimeout);
    installMcpDeployment(storedMcp);
    try (AutoCloseable env =
        ConfigSources.overrideForTest(MCP_CONFIGURATION, ConfigSourceMode.ENV)) {
      ConflictException rejected =
          assertThrows(
              ConflictException.class,
              () -> execute(HttpMethod.PUT, MCP_CONFIG_PATH, update.toString()));
      assertEquals(409, rejected.getStatusCode());
    }
    assertEquals(storedMcp, dao.getConfigJsonWithKey(MCP_CONFIGURATION.value()));
  }

  private static void installAuthorizerDeployment(JsonNode deploymentValue) {
    DeploymentTemplate template =
        DeploymentTemplate.parse(
            """
            authorizerConfiguration:
              adminPrincipals: ${AUTHORIZER_ADMIN_PRINCIPALS:-[admin]}
            """,
            "/authorizerConfiguration");
    ConfigSources.install(
        DeploymentConfig.of(
            List.of(new DeploymentSetting(DualSourceSetting.AUTHORIZER, deploymentValue, template)),
            new ConfigSourceConfiguration().withSecurity(ConfigSourceMode.AUTO)));
  }

  private static void installMcpDeployment(String storedMcp) {
    DeploymentTemplate template =
        DeploymentTemplate.parse(
            """
            mcpConfiguration:
              connectTimeout: ${MCP_CONNECT_TIMEOUT:-30}
            """,
            "/mcpConfiguration");
    JsonNode deploymentValue =
        storedMcp == null ? MAPPER.createObjectNode() : JsonUtils.readTree(storedMcp);
    ConfigSources.install(
        DeploymentConfig.of(
            List.of(new DeploymentSetting(DualSourceSetting.MCP, deploymentValue, template)),
            new ConfigSourceConfiguration()));
  }

  /** Replays a start of this server with {@code deploymentValue} as its deployment configuration. */
  private void restart(JsonNode deploymentValue) {
    reconcile(deploymentValue);
    reloadSecurity();
  }

  /** The start-up reconciliation of a server whose deployment configuration is the given value. */
  private void reconcile(JsonNode deploymentValue) {
    reconcile(deploymentValue, TEMPLATE);
  }

  private void reconcile(JsonNode deploymentValue, DeploymentTemplate template) {
    DeploymentConfig deployment = installDeployment(deploymentValue, template);
    new DeploymentConfigReconciler(dao, Entity.getSystemRepository(), "2.1.0")
        .reconcile(deployment, deployment.setting(AUTHENTICATION_CONFIGURATION).orElseThrow());
  }

  /** Makes {@code deploymentValue} this server's deployment configuration without a restart. */
  private static DeploymentConfig installDeployment(
      JsonNode deploymentValue, DeploymentTemplate template) {
    DeploymentSetting setting =
        new DeploymentSetting(DualSourceSetting.AUTHENTICATION, deploymentValue, template);
    DeploymentConfig deployment =
        DeploymentConfig.of(
            List.of(setting), new ConfigSourceConfiguration().withSecurity(ConfigSourceMode.AUTO));
    ConfigSources.install(deployment);
    return deployment;
  }

  private static int runningMaxActiveSessionsPerUser() {
    return SecurityConfigurationManager.getCurrentAuthConfig().getMaxActiveSessionsPerUser();
  }

  private ObjectNode storedWith(int maxActiveSessionsPerUser, boolean enableSelfSignup) {
    ObjectNode deployment = storedAuthentication();
    deployment.put("maxActiveSessionsPerUser", maxActiveSessionsPerUser);
    deployment.put("enableSelfSignup", enableSelfSignup);
    return deployment;
  }

  private ObjectNode storedAuthentication() {
    return SettingsSecrets.decrypted(
        AUTHENTICATION_CONFIGURATION, JsonUtils.readTree(dao.getConfigJsonWithKey(AUTH)));
  }

  private void store(JsonNode authentication) {
    dao.insertSettings(
        AUTH,
        JsonUtils.pojoToJson(
            SettingsSecrets.encrypted(AUTHENTICATION_CONFIGURATION, authentication)));
  }

  private void clearSnapshot() {
    dao.updateDeploymentSnapshot(AUTH, null);
  }

  private static void reloadSecurity() {
    SettingsCache.invalidateSettings(AUTH);
    SecurityConfigurationManager.getInstance().reloadSecuritySystem();
  }

  private JsonNode authenticationSource() throws Exception {
    for (JsonNode setting :
        MAPPER.readTree(execute(HttpMethod.GET, SETTINGS_SOURCE_PATH, null)).get("settings")) {
      if (AUTH.equals(setting.path("configType").asText())) {
        return setting;
      }
    }
    throw new AssertionError("No source reported for " + AUTH);
  }

  private JsonNode currentSecurity() throws Exception {
    return MAPPER.readTree(execute(HttpMethod.GET, SECURITY_CONFIG_PATH, null));
  }

  /** Saves one authentication field the way the SSO settings page does: read, edit, PUT. */
  private void saveInUi(String authenticationField, Object value) throws Exception {
    ObjectNode security = (ObjectNode) currentSecurity();
    ((ObjectNode) security.get("authenticationConfiguration"))
        .set(authenticationField, MAPPER.valueToTree(value));
    execute(HttpMethod.PUT, SECURITY_CONFIG_PATH, security.toString());
  }

  private void patchSecurity(String op, String path, Object value) throws Exception {
    String patch =
        MAPPER.writeValueAsString(List.of(Map.of("op", op, "path", path, "value", value)));
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            SECURITY_CONFIG_PATH,
            patch,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
  }

  private static String execute(HttpMethod method, String path, String body) throws Exception {
    return execute(SdkClients.adminClient(), method, path, body);
  }

  private static String execute(
      OpenMetadataClient client, HttpMethod method, String path, String body) throws Exception {
    return client
        .getHttpClient()
        .executeForString(method, path, body, RequestOptions.builder().build());
  }
}
