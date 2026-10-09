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

package org.openmetadata.service.config.source;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.EMAIL_CONFIGURATION;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.configuration.ConfigSourceConfiguration;
import org.openmetadata.schema.configuration.ConfigSourceMode;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.system.OverriddenSettingField;
import org.openmetadata.schema.system.SettingSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.SettingsManagedByEnvironmentException;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;

class SettingsSourceServiceTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String AUTH = AUTHENTICATION_CONFIGURATION.value();
  private static final DeploymentTemplate TEMPLATE =
      DeploymentTemplate.parse(
          """
          authenticationConfiguration:
            provider: ${AUTHENTICATION_PROVIDER:-basic}
            providerName: ${AUTHENTICATION_PROVIDER_NAME:-basic}
            clientId: ${AUTHENTICATION_CLIENT_ID:-""}
            enableSelfSignup: ${AUTHENTICATION_ENABLE_SELF_SIGNUP:-false}
            maxActiveSessionsPerUser: ${AUTHENTICATION_MAX_ACTIVE_SESSIONS_PER_USER:-5}
            publicKeyUrls: ${AUTHENTICATION_PUBLIC_KEYS:-[http://localhost:8585/api/v1/system/config/jwks]}
          """,
          "/authenticationConfiguration");
  private static final DeploymentTemplate AUTHORIZER_TEMPLATE =
      DeploymentTemplate.parse(
          """
          authorizerConfiguration:
            adminPrincipals: ${AUTHORIZER_ADMIN_PRINCIPALS:-[admin]}
          """,
          "/authorizerConfiguration");
  private static final String DEPLOYMENT =
      "{'provider':'google','providerName':'Google','clientId':'deployment-client',"
          + "'enableSelfSignup':true,'maxActiveSessionsPerUser':1000}";

  private final Map<String, String> rows = new ConcurrentHashMap<>();
  private final List<Settings> written = new ArrayList<>();
  private final List<SettingsType> refreshed = new ArrayList<>();
  private SettingsSourceService service;

  @BeforeEach
  void setUp() {
    SystemDAO dao = mock(SystemDAO.class);
    when(dao.getConfigJsonWithKey(anyString())).thenAnswer(i -> rows.get(i.<String>getArgument(0)));
    SystemRepository repository = mock(SystemRepository.class);
    doAnswer(
            i -> {
              Settings settings = i.getArgument(0);
              written.add(settings);
              rows.put(
                  settings.getConfigType().value(),
                  JsonUtils.pojoToJson(settings.getConfigValue()));
              return null;
            })
        .when(repository)
        .createOrUpdate(any(Settings.class));
    service = new SettingsSourceService(dao, repository, refreshed::add);
    installDeployment(DEPLOYMENT);
  }

  @AfterEach
  void tearDown() {
    ConfigSources.install(null);
  }

  @Test
  void reportsTheDeploymentValuesTheStoredSettingOverrides() {
    store(
        "{'provider':'google','providerName':'Google','clientId':'deployment-client',"
            + "'enableSelfSignup':false,'maxActiveSessionsPerUser':1000}");

    SettingSource source = service.status(AUTHENTICATION_CONFIGURATION).orElseThrow();

    assertEquals(ConfigSourceMode.AUTO, source.getSource());
    assertEquals("SECURITY_CONFIG_SOURCE", source.getSourceVariable());
    assertTrue(source.getEditable());
    assertTrue(source.getManagedPaths().isEmpty());
    OverriddenSettingField overridden = source.getOverriddenFields().getFirst();
    assertEquals(1, source.getOverriddenFields().size());
    assertEquals("/enableSelfSignup", overridden.getPath());
    assertEquals("AUTHENTICATION_ENABLE_SELF_SIGNUP", overridden.getEnvVariable());
  }

  @Test
  void doesNotReportADeploymentValueThatOnlyRepeatsTheTemplateDefault() {
    installDeployment(
        "{'provider':'google','providerName':'Google','clientId':'deployment-client',"
            + "'enableSelfSignup':false,'maxActiveSessionsPerUser':1000}");
    store(
        "{'provider':'google','providerName':'Google','clientId':'deployment-client',"
            + "'enableSelfSignup':true,'maxActiveSessionsPerUser':1000}");

    assertTrue(service.status().getSettings().getFirst().getOverriddenFields().isEmpty());
  }

  @Test
  void reportsNoOverridesWhileNothingIsStored() {
    assertTrue(service.status().getSettings().getFirst().getOverriddenFields().isEmpty());
  }

  @Test
  void envModeReportsTheFieldsTheDeploymentOwnsAsReadOnly() throws Exception {
    store(DEPLOYMENT);
    try (AutoCloseable env =
        ConfigSources.overrideForTest(AUTHENTICATION_CONFIGURATION, ConfigSourceMode.ENV)) {
      SettingSource source = service.status().getSettings().getFirst();

      assertEquals(ConfigSourceMode.ENV, source.getSource());
      assertFalse(source.getEditable());
      assertTrue(source.getManagedPaths().contains("/maxActiveSessionsPerUser"));
      assertTrue(source.getOverriddenFields().isEmpty());
    }
  }

  @Test
  void reportsNothingWithoutADeploymentConfiguration() {
    ConfigSources.install(null);

    assertTrue(service.status().getSettings().isEmpty());
    assertTrue(service.status(AUTHENTICATION_CONFIGURATION).isEmpty());
  }

  @Test
  void adoptsOnlyTheRequestedFieldAndRefreshesTheSetting() {
    store(
        "{'provider':'google','providerName':'Google','clientId':'deployment-client',"
            + "'enableSelfSignup':false,'maxActiveSessionsPerUser':42,'jwtTeamClaimMapping':'ui'}");

    service.adopt(AUTHENTICATION_CONFIGURATION, List.of("/enableSelfSignup"));

    JsonNode stored = stored();
    assertTrue(stored.get("enableSelfSignup").asBoolean());
    assertEquals(42, stored.get("maxActiveSessionsPerUser").asInt());
    assertEquals("ui", stored.get("jwtTeamClaimMapping").asText());
    assertEquals(List.of(AUTHENTICATION_CONFIGURATION), refreshed);
  }

  @Test
  void adoptsEveryOverriddenFieldWhenNoneAreNamed() {
    store(
        "{'provider':'google','providerName':'Google','clientId':'deployment-client',"
            + "'enableSelfSignup':false,'maxActiveSessionsPerUser':42}");

    service.adopt(AUTHENTICATION_CONFIGURATION, null);

    assertTrue(stored().get("enableSelfSignup").asBoolean());
    assertEquals(1000, stored().get("maxActiveSessionsPerUser").asInt());
  }

  /**
   * The deployment only sets the session cap on purpose; everything else is the file's default. The
   * SSO configured in the UI must survive "Use deployment value" without fields.
   */
  @Test
  void takesOnlyTheReportedFieldsWhenNoneAreNamed() {
    installDeployment(
        "{'provider':'basic','providerName':'basic','clientId':'','enableSelfSignup':false,"
            + "'maxActiveSessionsPerUser':1000}");
    store(
        "{'provider':'google','providerName':'Google','clientId':'ui-client',"
            + "'callbackUrl':'https://om.example.com/callback','enableSelfSignup':true,"
            + "'maxActiveSessionsPerUser':5}");

    assertEquals(List.of("/maxActiveSessionsPerUser"), overriddenPaths());
    assertEquals(
        List.of("/maxActiveSessionsPerUser"), service.adopt(AUTHENTICATION_CONFIGURATION, null));

    JsonNode stored = stored();
    assertEquals("google", stored.get("provider").asText());
    assertEquals("ui-client", stored.get("clientId").asText());
    assertEquals("https://om.example.com/callback", stored.get("callbackUrl").asText());
    assertTrue(stored.get("enableSelfSignup").asBoolean());
    assertEquals(1000, stored.get("maxActiveSessionsPerUser").asInt());
  }

  @Test
  void adoptsNothingWhileNothingIsOverridden() {
    installDeployment(
        "{'provider':'basic','providerName':'basic','clientId':'','enableSelfSignup':false,"
            + "'maxActiveSessionsPerUser':5}");
    store(
        "{'provider':'google','providerName':'Google','clientId':'ui-client',"
            + "'enableSelfSignup':true,'maxActiveSessionsPerUser':42}");

    assertTrue(service.adopt(AUTHENTICATION_CONFIGURATION, List.of()).isEmpty());

    assertTrue(written.isEmpty());
    assertTrue(refreshed.isEmpty());
  }

  /**
   * Helm sets its own JWKS address, so the deployment's public keys count as deliberate while its
   * provider is still the default one. Taking those keys would drop the keys of the provider
   * configured in the UI, or switch the provider to the default.
   */
  @Test
  void refusesProviderFieldsOfADeploymentThatNamesNoProvider() {
    installDeployment(
        "{'provider':'basic','providerName':'basic',"
            + "'publicKeyUrls':['http://openmetadata:8585/api/v1/system/config/jwks']}");
    store(
        "{'provider':'okta','providerName':'Okta','clientId':'okta-client',"
            + "'authority':'https://example.okta.com',"
            + "'publicKeyUrls':['https://example.okta.com/oauth2/v1/keys']}");

    assertTrue(overriddenPaths().isEmpty());
    assertThrows(
        IllegalArgumentException.class,
        () -> service.adopt(AUTHENTICATION_CONFIGURATION, List.of("/publicKeyUrls")));
    assertTrue(written.isEmpty());
  }

  @Test
  void takesAProviderFieldOfTheSameProviderAlone() {
    installDeployment(
        "{'provider':'okta','providerName':'Okta','clientId':'okta-client',"
            + "'authority':'https://example.okta.com','enableSelfSignup':false,"
            + "'publicKeyUrls':['https://example.okta.com/oauth2/v1/keys']}");
    store(
        "{'provider':'okta','providerName':'Okta','clientId':'okta-client',"
            + "'authority':'https://example.okta.com','enableSelfSignup':true,"
            + "'publicKeyUrls':['https://old.example.com/keys']}");

    assertEquals(
        List.of("/publicKeyUrls"),
        service.adopt(AUTHENTICATION_CONFIGURATION, List.of("/publicKeyUrls")));

    assertEquals(
        "https://example.okta.com/oauth2/v1/keys", stored().at("/publicKeyUrls/0").asText());
    assertTrue(stored().get("enableSelfSignup").asBoolean());
  }

  @Test
  void neverReplacesAStoredValueWithABlankDeploymentValue() {
    installDeployment(
        "{'provider':'google','providerName':'Google','clientId':'deployment-client',"
            + "'enableSelfSignup':true}");
    store(
        "{'provider':'google','providerName':'Google','clientId':'deployment-client',"
            + "'enableSelfSignup':true,'maxActiveSessionsPerUser':42}");

    assertTrue(
        service
            .adopt(AUTHENTICATION_CONFIGURATION, List.of("/maxActiveSessionsPerUser"))
            .isEmpty());

    assertEquals(42, stored().get("maxActiveSessionsPerUser").asInt());
  }

  @Test
  void adoptingTheProviderTakesTheWholeIdentityProviderFromTheDeployment() {
    store(
        "{'provider':'okta','providerName':'Okta','clientId':'okta-client',"
            + "'enableSelfSignup':false,'maxActiveSessionsPerUser':1000}");

    service.adopt(AUTHENTICATION_CONFIGURATION, List.of("/provider"));

    AuthenticationConfiguration adopted =
        JsonUtils.convertValue(stored(), AuthenticationConfiguration.class);
    assertEquals("google", adopted.getProvider().value());
    assertEquals("Google", adopted.getProviderName());
    assertEquals("deployment-client", adopted.getClientId());
    assertFalse(adopted.getEnableSelfSignup());
  }

  @Test
  void refusesToAdoptWhileTheDeploymentOwnsTheSetting() throws Exception {
    store(DEPLOYMENT);
    try (AutoCloseable env =
        ConfigSources.overrideForTest(AUTHENTICATION_CONFIGURATION, ConfigSourceMode.ENV)) {
      SettingsManagedByEnvironmentException refused =
          assertThrows(
              SettingsManagedByEnvironmentException.class,
              () -> service.adopt(AUTHENTICATION_CONFIGURATION, List.of()));
      assertTrue(refused.getMessage().contains("(SECURITY_CONFIG_SOURCE=ENV), so it cannot"));
    }
    assertTrue(written.isEmpty());
  }

  @Test
  void adminsAddedHereDoNotOverrideTheDeploymentAdmins() {
    installAuthorizer("{'adminPrincipals':['admin','ops']}");
    rows.put(
        AUTHORIZER_CONFIGURATION.value(), "{\"adminPrincipals\":[\"admin\",\"ui-admin\",\"ops\"]}");

    assertTrue(
        service.status(AUTHORIZER_CONFIGURATION).orElseThrow().getOverriddenFields().isEmpty());
    assertTrue(service.adopt(AUTHORIZER_CONFIGURATION, List.of()).isEmpty());
    assertTrue(written.isEmpty());
  }

  @Test
  void adoptingTheAdminsRestoresTheDeploymentAdminsAndKeepsThoseAddedHere() {
    installAuthorizer("{'adminPrincipals':['admin','ops']}");
    rows.put(AUTHORIZER_CONFIGURATION.value(), "{\"adminPrincipals\":[\"admin\",\"ui-admin\"]}");

    List<String> overridden =
        service.status(AUTHORIZER_CONFIGURATION).orElseThrow().getOverriddenFields().stream()
            .map(OverriddenSettingField::getPath)
            .toList();
    assertEquals(List.of("/adminPrincipals"), overridden);
    assertEquals(List.of("/adminPrincipals"), service.adopt(AUTHORIZER_CONFIGURATION, List.of()));

    JsonNode admins =
        JsonUtils.readTree(rows.get(AUTHORIZER_CONFIGURATION.value())).get("adminPrincipals");
    assertEquals(List.of("admin", "ui-admin", "ops"), JsonUtils.convertValue(admins, List.class));
  }

  @Test
  void refusesToAdoptASettingTheDeploymentDoesNotDefine() {
    assertThrows(
        IllegalArgumentException.class, () -> service.adopt(EMAIL_CONFIGURATION, List.of()));
    assertTrue(written.isEmpty());
  }

  private void installDeployment(String deploymentValue) {
    DeploymentSetting setting =
        new DeploymentSetting(DualSourceSetting.AUTHENTICATION, json(deploymentValue), TEMPLATE);
    ConfigSources.install(
        DeploymentConfig.of(
            List.of(setting), new ConfigSourceConfiguration().withSecurity(ConfigSourceMode.AUTO)));
  }

  private void installAuthorizer(String deploymentValue) {
    DeploymentSetting setting =
        new DeploymentSetting(
            DualSourceSetting.AUTHORIZER, json(deploymentValue), AUTHORIZER_TEMPLATE);
    ConfigSources.install(
        DeploymentConfig.of(
            List.of(setting), new ConfigSourceConfiguration().withSecurity(ConfigSourceMode.AUTO)));
  }

  private List<String> overriddenPaths() {
    return service.status(AUTHENTICATION_CONFIGURATION).orElseThrow().getOverriddenFields().stream()
        .map(OverriddenSettingField::getPath)
        .toList();
  }

  private void store(String singleQuoted) {
    rows.put(AUTH, json(singleQuoted).toString());
  }

  private JsonNode stored() {
    return JsonUtils.readTree(rows.get(AUTH));
  }

  private static JsonNode json(String singleQuoted) {
    try {
      return MAPPER.readTree(singleQuoted.replace('\'', '"'));
    } catch (JsonProcessingException invalid) {
      throw new IllegalArgumentException(singleQuoted, invalid);
    }
  }
}
