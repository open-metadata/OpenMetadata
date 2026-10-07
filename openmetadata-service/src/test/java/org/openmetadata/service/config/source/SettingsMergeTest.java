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
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.ConfigSourceMode;

class SettingsMergeTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private static final String AUTH_TEMPLATE =
      """
      authenticationConfiguration:
        clientType: ${AUTHENTICATION_CLIENT_TYPE:-public}
        provider: ${AUTHENTICATION_PROVIDER:-basic}
        authority: ${AUTHENTICATION_AUTHORITY:-https://accounts.google.com}
        clientId: ${AUTHENTICATION_CLIENT_ID:-""}
        emailClaim: ${AUTHENTICATION_EMAIL_CLAIM:-""}
        jwtPrincipalClaims: ${AUTHENTICATION_JWT_PRINCIPAL_CLAIMS:-[email,preferred_username,sub]}
        enableSelfSignup: ${AUTHENTICATION_ENABLE_SELF_SIGNUP:-true}
        sessionExpiry: ${AUTHENTICATION_SESSION_EXPIRY:-"604800"}
        maxActiveSessionsPerUser: ${AUTHENTICATION_MAX_ACTIVE_SESSIONS_PER_USER:-5}
        oidcConfiguration:
          id: ${OIDC_CLIENT_ID:-""}
          secret: ${OIDC_CLIENT_SECRET:-""}
          discoveryUri: ${OIDC_DISCOVERY_URI:-""}
          scope: ${OIDC_SCOPE:-"openid email profile"}
        ldapConfiguration:
          host: ${AUTHENTICATION_LDAP_HOST:-}
          maxPoolSize: ${AUTHENTICATION_LDAP_POOL_SIZE:-3}
      authorizerConfiguration:
        className: ${AUTHORIZER_CLASS_NAME:-org.openmetadata.service.security.DefaultAuthorizer}
        adminPrincipals: ${AUTHORIZER_ADMIN_PRINCIPALS:-[admin]}
        principalDomain: ${AUTHORIZER_PRINCIPAL_DOMAIN:-"open-metadata.org"}
        enforcePrincipalDomain: ${AUTHORIZER_ENFORCE_PRINCIPAL_DOMAIN:-false}
      """;

  private static final DeploymentTemplate AUTH =
      DeploymentTemplate.parse(AUTH_TEMPLATE, "/authenticationConfiguration");
  private static final DeploymentTemplate AUTHZ =
      DeploymentTemplate.parse(AUTH_TEMPLATE, "/authorizerConfiguration");

  private final SettingsMerge merge = new SettingsMerge();

  @Test
  void firstReconcileFillsADeliberateValueTheStoredSettingNeverHad() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'basic','maxActiveSessionsPerUser':1000}",
            "{'provider':'basic'}",
            null);

    assertEquals(1000, result.stored().get("maxActiveSessionsPerUser").asInt());
    assertTrue(result.report().has(MergeOutcome.BACKFILLED));
  }

  @Test
  void firstReconcileTreatsAnExplicitlyStoredDefaultOfAnAllowListedFieldAsUnset() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'basic','maxActiveSessionsPerUser':1000}",
            "{'provider':'basic','maxActiveSessionsPerUser':5}",
            null);

    assertEquals(1000, result.stored().get("maxActiveSessionsPerUser").asInt());
  }

  @Test
  void firstReconcileNeverOverwritesAStoredValueAndReportsTheDrift() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'custom-oidc','clientType':'confidential'}",
            "{'provider':'basic'}",
            null);

    assertEquals("basic", result.stored().get("provider").asText());
    assertFalse(result.storedChanged());
    assertTrue(result.report().has(MergeOutcome.DRIFT));
  }

  @Test
  void firstReconcileDoesNotRefillAFieldClearedInTheUiFromAFileDefault() {
    MergeResult result =
        authz(
            ConfigSourceMode.AUTO,
            "{'principalDomain':'open-metadata.org','enforcePrincipalDomain':false}",
            "{'enforcePrincipalDomain':false}",
            null);

    assertFalse(result.stored().has("principalDomain"));
    assertFalse(result.storedChanged());
  }

  @Test
  void deploymentChangeIsAppliedWhenTheUiDidNotChangeTheField() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'basic','maxActiveSessionsPerUser':1000}",
            "{'provider':'basic','maxActiveSessionsPerUser':5}",
            "{'provider':'basic','maxActiveSessionsPerUser':5}");

    assertEquals(1000, result.stored().get("maxActiveSessionsPerUser").asInt());
    assertTrue(result.report().has(MergeOutcome.APPLIED));
  }

  @Test
  void uiValueWinsWhenBothSidesChangedTheSameField() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'basic','maxActiveSessionsPerUser':1000}",
            "{'provider':'basic','maxActiveSessionsPerUser':20}",
            "{'provider':'basic','maxActiveSessionsPerUser':5}");

    assertEquals(20, result.stored().get("maxActiveSessionsPerUser").asInt());
    assertTrue(result.report().has(MergeOutcome.CONFLICT));
  }

  @Test
  void bothSidesChangingToTheSameValueIsNotAConflict() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'basic','maxActiveSessionsPerUser':20}",
            "{'provider':'basic','maxActiveSessionsPerUser':20}",
            "{'provider':'basic','maxActiveSessionsPerUser':5}");

    assertFalse(result.report().has(MergeOutcome.CONFLICT));
    assertFalse(result.storedChanged());
  }

  @Test
  void uiChangeSurvivesAnUnrelatedDeploymentChange() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'basic','enableSelfSignup':true,'maxActiveSessionsPerUser':1000}",
            "{'provider':'basic','enableSelfSignup':false,'maxActiveSessionsPerUser':5}",
            "{'provider':'basic','enableSelfSignup':true,'maxActiveSessionsPerUser':5}");

    assertFalse(result.stored().get("enableSelfSignup").asBoolean());
    assertEquals(1000, result.stored().get("maxActiveSessionsPerUser").asInt());
  }

  @Test
  void anEmptyDeploymentValueNeverWipesAStoredSecret() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'custom-oidc','clientType':'confidential','oidcConfiguration':{'id':'om'}}",
            "{'provider':'custom-oidc','clientType':'confidential',"
                + "'oidcConfiguration':{'id':'om','secret':'s3cret'}}",
            "{'provider':'custom-oidc','clientType':'confidential',"
                + "'oidcConfiguration':{'id':'om','secret':'s3cret'}}");

    assertEquals("s3cret", result.stored().at("/oidcConfiguration/secret").asText());
    assertTrue(result.report().has(MergeOutcome.KEPT_OVER_BLANK));
  }

  /**
   * Compose files pass unset variables as {@code ""}, which differs from the file default. Such a
   * blank value is not an override the UI hides, so it is never reported, on any start.
   */
  @Test
  void aBlankDeploymentValueIsNeverReportedAsOverriddenByTheStoredValue() {
    String deployment = "{'provider':'basic','maxActiveSessionsPerUser':''}";
    String stored = "{'provider':'basic'}";

    for (String lastApplied : Arrays.asList(null, deployment)) {
      MergeResult result = auth(ConfigSourceMode.AUTO, deployment, stored, lastApplied);

      assertFalse(result.report().has(MergeOutcome.DRIFT), "last applied " + lastApplied);
      assertFalse(result.storedChanged());
    }
  }

  @Test
  void deploymentChangesToProviderFieldsAreIgnoredAfterTheUiSwitchedProvider() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'basic','jwtPrincipalClaims':['upn']}",
            "{'provider':'okta','clientId':'okta-client','authority':'https://okta.example.com'}",
            "{'provider':'basic','jwtPrincipalClaims':['email']}");

    assertEquals("okta", result.stored().get("provider").asText());
    assertFalse(result.stored().has("jwtPrincipalClaims"));
    assertTrue(result.report().has(MergeOutcome.IGNORED_FOR_IDENTITY));
  }

  @Test
  void providerSwitchedInTheDeploymentBringsItsFieldsAlong() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'custom-oidc','clientType':'confidential','clientId':'om',"
                + "'authority':'https://idp.example.com',"
                + "'oidcConfiguration':{'id':'om','secret':'s3cret',"
                + "'discoveryUri':'https://idp.example.com/.well-known'}}",
            "{'provider':'basic','enableSelfSignup':false}",
            "{'provider':'basic','enableSelfSignup':true}");

    assertEquals("custom-oidc", result.stored().get("provider").asText());
    assertEquals("s3cret", result.stored().at("/oidcConfiguration/secret").asText());
    assertFalse(result.stored().get("enableSelfSignup").asBoolean());
    assertTrue(result.report().isIdentityProviderReplaced());
  }

  @Test
  void blocksOfProvidersTheStoredSettingDoesNotUseAreNotCreated() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'basic','ldapConfiguration':{'maxPoolSize':10}}",
            "{'provider':'basic'}",
            "{'provider':'basic','ldapConfiguration':{'maxPoolSize':3}}");

    assertFalse(result.stored().has("ldapConfiguration"));
    assertFalse(result.storedChanged());
  }

  @Test
  void claimsAreAppliedAllOrNothing() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'basic','jwtPrincipalClaims':['upn'],'emailClaim':'mail'}",
            "{'provider':'basic','jwtPrincipalClaims':['email'],'emailClaim':'email'}",
            "{'provider':'basic','jwtPrincipalClaims':['email'],'emailClaim':'mail'}");

    assertEquals("email", result.stored().get("emailClaim").asText());
    assertEquals("email", result.stored().at("/jwtPrincipalClaims/0").asText());
    assertTrue(result.report().has(MergeOutcome.CONFLICT));
  }

  @Test
  void adminPrincipalsAreMergedEntryByEntry() {
    MergeResult added =
        authz(
            ConfigSourceMode.AUTO,
            "{'adminPrincipals':['admin','ops']}",
            "{'adminPrincipals':['admin','alice']}",
            "{'adminPrincipals':['admin']}");
    MergeResult revoked =
        authz(
            ConfigSourceMode.AUTO,
            "{'adminPrincipals':['ops']}",
            "{'adminPrincipals':['admin','alice','ops']}",
            "{'adminPrincipals':['admin','ops']}");

    assertEquals(json("['admin','alice','ops']"), added.stored().get("adminPrincipals"));
    assertEquals(json("['alice','ops']"), revoked.stored().get("adminPrincipals"));
  }

  @Test
  void deploymentOwnedFieldsAlwaysComeFromTheDeployment() {
    MergeResult result =
        authz(
            ConfigSourceMode.AUTO,
            "{'className':'org.example.CustomAuthorizer'}",
            "{'className':'org.openmetadata.service.security.DefaultAuthorizer'}",
            "{'className':'org.openmetadata.service.security.DefaultAuthorizer'}");

    assertEquals("org.example.CustomAuthorizer", result.stored().get("className").asText());
  }

  @Test
  void aChangedDefaultIsAppliedWhereTheUiNeverSetTheField() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'basic','tokenValidationAlgorithm':'RS512'}",
            "{'provider':'basic','tokenValidationAlgorithm':'RS256'}",
            "{'provider':'basic','tokenValidationAlgorithm':'RS256'}");

    assertEquals("RS512", result.stored().get("tokenValidationAlgorithm").asText());
    assertTrue(result.report().has(MergeOutcome.DEFAULT_CHANGED));
  }

  @Test
  void dbModeIgnoresDeploymentChangesButStillFillsMissingFields() {
    MergeResult result =
        auth(
            ConfigSourceMode.DB,
            "{'provider':'basic','maxActiveSessionsPerUser':1000,'enableSelfSignup':false}",
            "{'provider':'basic','enableSelfSignup':true}",
            "{'provider':'basic','enableSelfSignup':true}");

    assertTrue(result.stored().get("enableSelfSignup").asBoolean());
    assertEquals(1000, result.stored().get("maxActiveSessionsPerUser").asInt());
    assertTrue(result.report().has(MergeOutcome.IGNORED_BY_DB_MODE));
  }

  @Test
  void envModeOverwritesFieldsTheConfigurationFileDefinesAndKeepsTheRest() {
    MergeResult result =
        auth(
            ConfigSourceMode.ENV,
            "{'provider':'basic','enableSelfSignup':false}",
            "{'provider':'basic','enableSelfSignup':true,'jwtTeamClaimMapping':'groups'}",
            "{'provider':'basic','enableSelfSignup':false}");

    assertFalse(result.stored().get("enableSelfSignup").asBoolean());
    assertEquals("groups", result.stored().get("jwtTeamClaimMapping").asText());
  }

  @Test
  void switchingToEnvRefusesToReplaceTheProviderWithoutConfirmation() {
    MergeInput.MergeInputBuilder input =
        authInput(
            ConfigSourceMode.ENV,
            "{'provider':'basic'}",
            "{'provider':'okta','clientId':'okta','authority':'https://okta.example.com'}",
            null);

    assertThrows(
        ProviderChangeNotConfirmedException.class,
        () -> merge.merge(input.switchingToEnv(true).build()));
    MergeResult confirmed =
        merge.merge(input.switchingToEnv(true).confirmProviderChange(true).build());
    assertEquals("basic", confirmed.stored().get("provider").asText());
  }

  @Test
  void valuesAreComparedTheWayTheOperatorMeansThem() {
    assertTrue(SettingValues.same(json("'604800'"), json("604800")));
    assertTrue(SettingValues.same(json("''"), null));
    assertTrue(SettingValues.same(json("'{\\\"a\\\": 1}'"), json("{'a':1}")));
    assertTrue(
        SettingValues.same(
            json("'-----BEGIN X-----\\r\\nAAA'"), json("'-----BEGIN X-----\\nAAA'")));
    assertFalse(SettingValues.same(json("'a'"), json("'b'")));
  }

  @Test
  void templateKnowsVariablesDefaultsAndLiteralValues() {
    DeploymentTemplate template =
        DeploymentTemplate.parse(
            "section:\n  a: ${VAR_A:-[x,y]}\n  b: literal\n  c: ${VAR_C}\n", "/section");

    assertEquals("VAR_A", template.envVariable(List.of("/a")).orElseThrow());
    assertFalse(template.isDeliberate(json("{'a':['x','y']}"), List.of("/a")));
    assertTrue(template.isDeliberate(json("{'a':['z']}"), List.of("/a")));
    assertTrue(template.isDeliberate(json("{'b':'literal'}"), List.of("/b")));
    assertFalse(template.isDeliberate(json("{'c':'${VAR_C}'}"), List.of("/c")));
  }

  private MergeResult auth(
      ConfigSourceMode mode, String deployment, String stored, String lastApplied) {
    return merge.merge(authInput(mode, deployment, stored, lastApplied).build());
  }

  private MergeResult authz(
      ConfigSourceMode mode, String deployment, String stored, String lastApplied) {
    return merge.merge(
        input(AUTHZ, mode, deployment, stored, lastApplied)
            .policy(SettingsFieldPolicies.of(AUTHORIZER_CONFIGURATION))
            .build());
  }

  private static MergeInput.MergeInputBuilder authInput(
      ConfigSourceMode mode, String deployment, String stored, String lastApplied) {
    return input(AUTH, mode, deployment, stored, lastApplied)
        .policy(SettingsFieldPolicies.of(AUTHENTICATION_CONFIGURATION));
  }

  private static MergeInput.MergeInputBuilder input(
      DeploymentTemplate template,
      ConfigSourceMode mode,
      String deployment,
      String stored,
      String lastApplied) {
    return MergeInput.builder()
        .mode(mode)
        .template(template)
        .deployment(json(deployment))
        .stored(json(stored))
        .lastApplied(lastApplied == null ? null : json(lastApplied))
        .schemaDefaults(json("{'maxActiveSessionsPerUser':5,'enableSelfSignup':false}"));
  }

  private static JsonNode json(String singleQuoted) {
    try {
      return MAPPER.readTree(singleQuoted.replace('\'', '"'));
    } catch (JsonProcessingException invalid) {
      throw new IllegalArgumentException(singleQuoted, invalid);
    }
  }
}
