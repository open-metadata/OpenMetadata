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
import org.openmetadata.schema.settings.SettingsType;

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

  /**
   * A deployment template that mirrors the shipped LDAP block, including the trust-store password
   * environment variable written as {@code ${AUTHENTICATION_LDAP_KEYSTORE_PASSWORD:-}}, which a
   * missing mount resolves to an empty string. The trust store object is a single-value merge
   * unit that encloses a secret leaf.
   */
  private static final DeploymentTemplate LDAP =
      DeploymentTemplate.parse(
          """
          authenticationConfiguration:
            clientType: ${AUTHENTICATION_CLIENT_TYPE:-public}
            provider: ${AUTHENTICATION_PROVIDER:-basic}
            ldapConfiguration:
              host: ${AUTHENTICATION_LDAP_HOST:-}
              maxPoolSize: ${AUTHENTICATION_LDAP_POOL_SIZE:-3}
              dnAdminPassword: ${AUTHENTICATION_LDAP_ADMIN_PASSWORD:-""}
              trustStoreConfig:
                customTrustManagerConfig:
                  trustStoreFilePath: ${AUTHENTICATION_LDAP_TRUSTSTORE_PATH:-}
                  trustStoreFilePassword: ${AUTHENTICATION_LDAP_KEYSTORE_PASSWORD:-}
                  trustStoreFileFormat: ${AUTHENTICATION_LDAP_SSL_KEY_FORMAT:-}
                  verifyHostname: ${AUTHENTICATION_LDAP_SSL_VERIFY_CERT_HOST:-}
                  examineValidityDates: ${AUTHENTICATION_LDAP_EXAMINE_VALIDITY_DATES:-}
          """,
          "/authenticationConfiguration");

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
  void providerFieldsOfADeploymentThatNamesNoProviderOverrideNothing() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'basic','jwtPrincipalClaims':['upn']}",
            "{'provider':'okta','clientId':'okta-client','authority':'https://okta.example.com',"
                + "'jwtPrincipalClaims':['email']}",
            "{'provider':'basic','jwtPrincipalClaims':['upn']}");

    assertFalse(result.report().has(MergeOutcome.DRIFT));
    assertFalse(result.storedChanged());
  }

  @Test
  void providerFieldsOfADeploymentThatNamesItsProviderAreReportedAsOverridden() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'google','jwtPrincipalClaims':['upn']}",
            "{'provider':'okta','clientId':'okta-client','authority':'https://okta.example.com',"
                + "'jwtPrincipalClaims':['email']}",
            "{'provider':'google','jwtPrincipalClaims':['upn']}");

    assertTrue(result.report().has(MergeOutcome.DRIFT));
    assertFalse(result.storedChanged());
  }

  @Test
  void dbModeNeverFillsProviderFieldsFromADeploymentOfAnotherProvider() {
    MergeResult result =
        auth(
            ConfigSourceMode.DB,
            "{'provider':'basic','emailClaim':'mail'}",
            "{'provider':'okta','clientId':'okta-client','authority':'https://okta.example.com'}",
            null);

    assertFalse(result.stored().has("emailClaim"));
    assertFalse(result.report().has(MergeOutcome.BACKFILLED));
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

  @Test
  void aGroupNamesEveryVariableInTheOrderOfItsFields() {
    DeploymentTemplate template =
        DeploymentTemplate.parse(
            "section:\n  claims: ${CLAIMS:-[email]}\n  b: literal\n  displayName: ${DISPLAY:-''}\n",
            "/section");

    assertEquals(
        List.of("CLAIMS", "DISPLAY"),
        template.envVariables(List.of("/claims", "/b", "/displayName")));
  }

  @Test
  void addingEntriesToASetDoesNotOverrideTheDeployment() {
    MergeUnit admins = MergeUnit.field("/adminPrincipals", UnitKind.SET_MERGE);

    assertFalse(
        SettingsMerge.overridesDeployment(
            admins, json("['admin','ui-admin','ops']"), json("['ops','admin']")));
    assertTrue(
        SettingsMerge.overridesDeployment(admins, json("['admin','ui-admin']"), json("['ops']")));
  }

  @Test
  void aProviderSwitchKeepsTheStoredSecretOverABlankDeploymentSecret() {
    String before =
        "{'provider':'custom-oidc','clientType':'confidential','authority':'https://a.example',"
            + "'clientId':'om','oidcConfiguration':{'id':'om','secret':'s3cret',"
            + "'discoveryUri':'https://a.example/.well-known/openid-configuration'}}";
    String brokenSecretMount =
        before
            .replace("https://a.example','clientId", "https://b.example','clientId")
            .replace("'secret':'s3cret'", "'secret':''");

    MergeResult result = auth(ConfigSourceMode.AUTO, brokenSecretMount, before, before);

    assertEquals("https://b.example", result.stored().get("authority").asText());
    assertEquals("s3cret", result.stored().at("/oidcConfiguration/secret").asText());
    assertTrue(result.report().has(MergeOutcome.KEPT_OVER_BLANK));
  }

  @Test
  void anEmptiedAdminListKeepsTheStoredAdmins() {
    MergeResult result =
        authz(
            ConfigSourceMode.AUTO,
            "{'adminPrincipals':[]}",
            "{'adminPrincipals':['admin','ops','ui-admin']}",
            "{'adminPrincipals':['admin','ops']}");

    assertEquals(3, result.stored().get("adminPrincipals").size());
    assertTrue(result.report().has(MergeOutcome.KEPT_OVER_BLANK));
  }

  @Test
  void firstReconcileTreatsTheShippedSessionExpiryAsUnset() {
    MergeResult result =
        auth(
            ConfigSourceMode.AUTO,
            "{'provider':'basic','sessionExpiry':86400}",
            "{'provider':'basic','sessionExpiry':604800}",
            null);

    assertEquals(86400, result.stored().get("sessionExpiry").asInt());
    assertTrue(result.report().has(MergeOutcome.BACKFILLED));
  }

  @Test
  void theDeploymentAlwaysSetsTheEmailTemplates() {
    DeploymentTemplate email =
        DeploymentTemplate.parse("email:\n  templates: ${TEMPLATES:-openmetadata}\n", "/email");
    MergeResult result =
        merge.merge(
            input(
                    email,
                    ConfigSourceMode.AUTO,
                    "{'templates':'collate'}",
                    "{'templates':'custom'}",
                    "{'templates':'openmetadata'}")
                .policy(SettingsFieldPolicies.of(SettingsType.EMAIL_CONFIGURATION))
                .build());

    assertEquals("collate", result.stored().get("templates").asText());
  }

  @Test
  void aDeploymentProviderSwitchReplacesClaimsTheUiSetForTheOldProvider() {
    String lastApplied =
        "{'provider':'custom-oidc','clientType':'public','authority':'https://a.example',"
            + "'clientId':'old-client','emailClaim':'email','jwtPrincipalClaims':['email']}";
    String uiClaims =
        lastApplied
            .replace("'emailClaim':'email'", "'emailClaim':'oldClaim'")
            .replace("'jwtPrincipalClaims':['email']", "'jwtPrincipalClaims':['oldClaim']");
    String newProvider =
        lastApplied
            .replace("https://a.example", "https://b.example")
            .replace("old-client", "new-client");

    MergeResult result = auth(ConfigSourceMode.AUTO, newProvider, uiClaims, lastApplied);

    assertEquals("new-client", result.stored().get("clientId").asText());
    assertEquals("email", result.stored().get("emailClaim").asText());
    assertEquals("email", result.stored().at("/jwtPrincipalClaims/0").asText());
  }

  @Test
  void aValueClearedInTheUiWinsOverALaterDeploymentChange() {
    DeploymentTemplate email =
        DeploymentTemplate.parse(
            "email:\n  supportUrl: ${OM_SUPPORT_URL:-https://default.example}\n", "/email");
    MergeResult result =
        merge.merge(
            input(
                    email,
                    ConfigSourceMode.AUTO,
                    "{'supportUrl':'https://new.example'}",
                    "{'supportUrl':''}",
                    "{'supportUrl':'https://old.example'}")
                .policy(SettingsFieldPolicies.of(SettingsType.EMAIL_CONFIGURATION))
                .build());

    assertEquals("", result.stored().get("supportUrl").asText());
    assertTrue(result.report().has(MergeOutcome.CONFLICT));
  }

  @Test
  void aFieldAFormLeftOutStillTakesTheDeploymentChange() {
    DeploymentTemplate email =
        DeploymentTemplate.parse(
            "email:\n  supportUrl: ${OM_SUPPORT_URL:-https://default.example}\n", "/email");
    MergeResult result =
        merge.merge(
            input(
                    email,
                    ConfigSourceMode.AUTO,
                    "{'supportUrl':'https://new.example'}",
                    "{}",
                    "{'supportUrl':'https://old.example'}")
                .policy(SettingsFieldPolicies.of(SettingsType.EMAIL_CONFIGURATION))
                .build());

    assertEquals("https://new.example", result.stored().get("supportUrl").asText());
  }

  // ---- Secrets nested inside a single-value merge unit (trustStoreConfig) ----
  // The policy marks /ldapConfiguration/trustStoreConfig as a single-value merge unit (compared and
  // applied whole) while {@link SettingsSecrets} discovers the trust-store password as a deep
  // leaf secret at
  // /ldapConfiguration/trustStoreConfig/customTrustManagerConfig/trustStoreFilePassword.
  // A naive secret guard only matches a unit pointer to a leaf secret pointer, so it never fires
  // for the enclosing object, and a missing ${AUTHENTICATION_LDAP_KEYSTORE_PASSWORD:-} env var
  // (resolved to "") wipes a password saved before. The tests pin the invariant: a blank deployment
  // value never replaces a stored secret, even when the secret is nested under a single-value unit.

  private static final String TRUSTSTORE_PASSWORD_POINTER =
      "/ldapConfiguration/trustStoreConfig/customTrustManagerConfig/trustStoreFilePassword";
  private static final String TRUSTSTORE_VERIFY_HOSTNAME_POINTER =
      "/ldapConfiguration/trustStoreConfig/customTrustManagerConfig/verifyHostname";
  private static final String TRUSTSTORE_FILE_PATH_POINTER =
      "/ldapConfiguration/trustStoreConfig/customTrustManagerConfig/trustStoreFilePath";

  @Test
  void aBlankNestedTrustStorePasswordIsKeptWhenTheTrustStoreObjectOtherwiseChanged() {
    // The deployment matches the stored block except the password env var went missing (resolves
    // to "") and verifyHostname was flipped: the whole object changed and stays non-blank, which
    // is the case the kept-over-blank guard for whole units misses.
    String stored = ldapTrustStore("ldap.example", "ks-p4ss", "/ts", false);
    MergeResult result =
        ldapAuth(
            ConfigSourceMode.AUTO, ldapTrustStore("ldap.example", "", "/ts", true), stored, stored);

    assertEquals(
        "ks-p4ss", trustStorePassword(result), "missing env var must not wipe stored secret");
    assertTrue(verifyHostname(result), "the unrelated sibling change is still applied");
    assertTrue(result.report().has(MergeOutcome.APPLIED));
    assertFalse(result.report().has(MergeOutcome.CONFLICT), "no UI edit, so no conflict");
  }

  @Test
  void aNestedTrustStorePasswordMissingFromTheDeploymentObjectIsKept() {
    // The deployment object omits the password leaf entirely; verifyHostname is added so the
    // object as a whole changed (and stays non-blank), the same shape as a form that hides the
    // password field.
    String stored = ldapTrustStore("ldap.example", "ks-p4ss", "/ts");
    MergeResult result =
        ldapAuth(ConfigSourceMode.AUTO, ldapTrustStoreNoPassword("/ts", true), stored, stored);

    assertEquals(
        "ks-p4ss",
        trustStorePassword(result),
        "an absent password leaf must not erase the stored secret");
    assertTrue(verifyHostname(result));
  }

  @Test
  void aNonBlankDeploymentNestedTrustStorePasswordReplacesTheStoredOne() {
    // The fix only keeps the stored secret over a BLANK deployment value; a deliberate non-blank
    // password replaces the stored one like any other value.
    String stored = ldapTrustStore("ldap.example", "ks-p4ss", "/ts");
    MergeResult result =
        ldapAuth(
            ConfigSourceMode.AUTO,
            ldapTrustStore("ldap.example", "new-pw", "/new-ts"),
            stored,
            stored);

    assertEquals(
        "new-pw",
        trustStorePassword(result),
        "a deliberate non-blank deployment password replaces the stored secret");
    assertEquals("/new-ts", trustStoreFilePath(result));
  }

  @Test
  void aProviderSwitchAwayFromLdapKeepsTheTrustStoreConfigAndPassword() {
    // A switch that brings no LDAP block must keep the old block's secrets, just as it keeps the
    // flat dnAdminPassword: a blank secret is far likelier a missing mount than a deliberate
    // removal.
    String stored = ldapWithDnAdminAndTrustStore("bind-pw", "ks-p4ss");
    MergeResult result =
        ldapAuth(
            ConfigSourceMode.AUTO, "{'provider':'basic','clientType':'public'}", stored, stored);

    assertEquals("basic", result.stored().get("provider").asText());
    assertEquals(
        "bind-pw",
        result.stored().at("/ldapConfiguration/dnAdminPassword").asText(),
        "the flat LDAP secret is kept across the switch (existing behaviour)");
    assertEquals(
        "ks-p4ss",
        trustStorePassword(result),
        "the nested trust-store secret is kept too, like the flat secret");
    assertTrue(
        result.stored().at("/ldapConfiguration/host").isMissingNode(),
        "non-secret provider fields are replaced by the switch");
    assertTrue(
        result.stored().at("/ldapConfiguration/maxPoolSize").isMissingNode(),
        "non-secret provider defaults are replaced by the switch");
    assertTrue(result.report().isIdentityProviderReplaced());
    assertTrue(
        keptOverBlank(result, "/ldapConfiguration/trustStoreConfig"),
        "the trust-store secret unit is kept over the blank deployment block");
    assertTrue(
        keptOverBlank(result, "/ldapConfiguration/dnAdminPassword"),
        "the flat secret is still kept over the blank deployment block");
  }

  @Test
  void aProviderSwitchToANewLdapAppliesItsTrustStoreConfigWithoutTheOldPassword() {
    // A switch to a different LDAP that brings its own trust-store object replaces the old one
    // wholesale; only the wholesale-blank case (an absent LDAP block) keeps the secret.
    String stored = ldapTrustStore("old.ldap.example", "old-pw", "/old-ts");
    MergeResult result =
        ldapAuth(
            ConfigSourceMode.AUTO,
            ldapTrustStore("new.ldap.example", "", "/new-ts"),
            stored,
            stored);

    assertEquals("new.ldap.example", result.stored().at("/ldapConfiguration/host").asText());
    assertEquals(
        "/new-ts",
        trustStoreFilePath(result),
        "the new provider's trust-store object replaces the old");
    assertEquals(
        "",
        trustStorePassword(result),
        "the old password is not carried across to a different provider's trust store");
    assertFalse(
        keptOverBlank(result, "/ldapConfiguration/trustStoreConfig"),
        "the switch owns the new trust-store object, so the secret-over-blank guard does not fire");
    assertTrue(result.report().isIdentityProviderReplaced());
  }

  @Test
  void aFlatLdapSecretIsKeptOverABlankDeploymentValue() {
    // Control: a flat secret whose leaf IS its own merge unit is already protected by the existing
    // kept-over-blank guard; the nested-secret fix must not change that behaviour.
    MergeResult result =
        ldapAuth(
            ConfigSourceMode.AUTO,
            ldapWithDnAdmin(""),
            ldapWithDnAdmin("bind-pw"),
            ldapWithDnAdmin("bind-pw"));

    assertEquals("bind-pw", result.stored().at("/ldapConfiguration/dnAdminPassword").asText());
    assertTrue(result.report().has(MergeOutcome.KEPT_OVER_BLANK));
  }

  @Test
  void aLaterSiblingChangeToTheTrustStoreObjectIsAppliedAfterThePasswordWasPreserved() {
    // Two reconciliations: the first preserves the password over a blank deployment value; the
    // second feeds that result's stored and lastApplied into a later deployment edit to a sibling
    // field (verifyHostname). Unless the preserved secret is carried into lastApplied, the sibling
    // edit reads as a conflict and is dropped even though nobody touched the UI.
    MergeResult second = reconcileAfterPreservingPassword(true);

    assertTrue(
        verifyHostname(second), "the later sibling edit is applied, not dropped as a conflict");
    assertEquals(
        "ks-p4ss",
        trustStorePassword(second),
        "the preserved password survives the later sibling edit");
    assertFalse(
        second.report().has(MergeOutcome.CONFLICT),
        "no UI edit happened, so the sibling change must not read as a conflict");
  }

  @Test
  void anUnchangedStartAfterThePasswordWasPreservedReportsNoChange() {
    // After the first reconciliation preserved the password over a blank deployment value, a later
    // unchanged start must not report the trust-store unit as APPLIED, DEFAULT_CHANGED or DRIFT
    // just because the deployment's password is still blank while lastApplied carries the preserved
    // value.
    MergeResult second = reconcileAfterPreservingPassword(false);

    assertEquals("ks-p4ss", trustStorePassword(second), "the preserved password survives");
    assertFalse(
        second.report().has(MergeOutcome.APPLIED),
        "an unchanged start must not report an applied change");
    assertFalse(
        second.report().has(MergeOutcome.DEFAULT_CHANGED),
        "an unchanged start must not report a default change");
    assertFalse(
        second.report().has(MergeOutcome.DRIFT), "an unchanged start must not report drift");
  }

  @Test
  void aRealUiEditOfTheNestedSecretStillConflictsWhenTheDeploymentSetsIt() {
    // The fix preserves a secret only over a BLANK deployment value; a deployment that deliberately
    // sets the secret still conflicts with a UI edit of it, so the UI value wins. The sibling edit
    // is dropped with it, as for any single-value conflict.
    String lastApplied = ldapTrustStore("ldap.example", "ks-p4ss", "/ts", false);
    String stored = ldapTrustStore("ldap.example", "ui-edit", "/ts", false);
    MergeResult result =
        ldapAuth(
            ConfigSourceMode.AUTO,
            ldapTrustStore("ldap.example", "dep-pw", "/ts", true),
            stored,
            lastApplied);

    assertEquals(
        "ui-edit",
        trustStorePassword(result),
        "UI edit kept when deployment sets a different value");
    assertFalse(verifyHostname(result), "the conflicting deployment sibling edit is not applied");
    assertTrue(result.report().has(MergeOutcome.CONFLICT));
  }

  private MergeResult auth(
      ConfigSourceMode mode, String deployment, String stored, String lastApplied) {
    return merge.merge(authInput(mode, deployment, stored, lastApplied).build());
  }

  private MergeResult ldapAuth(
      ConfigSourceMode mode, String deployment, String stored, String lastApplied) {
    return merge.merge(ldapAuthInput(mode, deployment, stored, lastApplied).build());
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

  private static MergeInput.MergeInputBuilder ldapAuthInput(
      ConfigSourceMode mode, String deployment, String stored, String lastApplied) {
    return input(LDAP, mode, deployment, stored, lastApplied)
        .policy(SettingsFieldPolicies.of(AUTHENTICATION_CONFIGURATION));
  }

  /** An LDAP authentication block whose trust-store object carries a password and verifyHostname. */
  private static String ldapTrustStore(
      String host, String password, String filePath, boolean verifyHostname) {
    return "{'provider':'ldap','clientType':'public','ldapConfiguration':{'host':'"
        + host
        + "','trustStoreConfig':{'customTrustManagerConfig':{'trustStoreFilePath':'"
        + filePath
        + "','trustStoreFilePassword':'"
        + password
        + "','trustStoreFileFormat':'JKS',"
        + "'verifyHostname':"
        + verifyHostname
        + "}}}}";
  }

  /** An LDAP authentication block whose trust-store object omits the verifyHostname leaf. */
  private static String ldapTrustStore(String host, String password, String filePath) {
    return "{'provider':'ldap','clientType':'public','ldapConfiguration':{'host':'"
        + host
        + "','trustStoreConfig':{'customTrustManagerConfig':{'trustStoreFilePath':'"
        + filePath
        + "','trustStoreFilePassword':'"
        + password
        + "','trustStoreFileFormat':'JKS'}}}}";
  }

  /** An LDAP authentication block whose trust-store object omits the password leaf entirely. */
  private static String ldapTrustStoreNoPassword(String filePath, boolean verifyHostname) {
    return "{'provider':'ldap','clientType':'public','ldapConfiguration':{'host':'ldap.example',"
        + "'trustStoreConfig':{'customTrustManagerConfig':{'trustStoreFilePath':'"
        + filePath
        + "','trustStoreFileFormat':'JKS','verifyHostname':"
        + verifyHostname
        + "}}}}";
  }

  /** An LDAP authentication block with a flat dnAdminPassword and a trust-store object. */
  private static String ldapWithDnAdminAndTrustStore(String dnPassword, String trustPassword) {
    return "{'provider':'ldap','clientType':'public','ldapConfiguration':{'host':'ldap.example',"
        + "'dnAdminPassword':'"
        + dnPassword
        + "','maxPoolSize':10,'trustStoreConfig':"
        + "{'customTrustManagerConfig':{'trustStoreFilePath':'/ts','trustStoreFilePassword':'"
        + trustPassword
        + "','trustStoreFileFormat':'JKS'}}}}";
  }

  /** An LDAP authentication block with only a flat dnAdminPassword (no trust-store object). */
  private static String ldapWithDnAdmin(String dnPassword) {
    return "{'provider':'ldap','clientType':'public','ldapConfiguration':{'host':'ldap.example',"
        + "'dnAdminPassword':'"
        + dnPassword
        + "','maxPoolSize':10}}";
  }

  private static String trustStorePassword(MergeResult result) {
    return result.stored().at(TRUSTSTORE_PASSWORD_POINTER).asText();
  }

  private static boolean verifyHostname(MergeResult result) {
    return result.stored().at(TRUSTSTORE_VERIFY_HOSTNAME_POINTER).asBoolean();
  }

  private static String trustStoreFilePath(MergeResult result) {
    return result.stored().at(TRUSTSTORE_FILE_PATH_POINTER).asText();
  }

  private static boolean keptOverBlank(MergeResult result, String pointer) {
    return result.report().units(MergeOutcome.KEPT_OVER_BLANK).stream()
        .anyMatch(unit -> unit.pointers().contains(pointer));
  }

  /**
   * Runs two reconciliations: the first preserves a stored password over a blank deployment value,
   * the second feeds the first result's stored and lastApplied into a deployment that still leaves
   * the password blank and flips verifyHostname to {@code finalVerifyHostname}.
   */
  private MergeResult reconcileAfterPreservingPassword(boolean finalVerifyHostname) {
    String stored = ldapTrustStore("ldap.example", "ks-p4ss", "/ts", false);
    MergeResult first =
        ldapAuth(
            ConfigSourceMode.AUTO,
            ldapTrustStore("ldap.example", "", "/ts", false),
            stored,
            stored);
    return merge.merge(
        ldapAuthInput(
                ConfigSourceMode.AUTO,
                ldapTrustStore("ldap.example", "", "/ts", finalVerifyHostname),
                "{}",
                null)
            .stored(first.stored())
            .lastApplied(first.lastApplied())
            .build());
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
