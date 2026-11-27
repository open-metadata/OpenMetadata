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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.sso.SsoFlows.idTokenFrom;
import static org.openmetadata.it.sso.SsoFlows.login;

import com.fasterxml.jackson.databind.JsonNode;
import com.unboundid.ldap.listener.InMemoryDirectoryServer;
import com.unboundid.ldap.listener.InMemoryDirectoryServerConfig;
import com.unboundid.ldap.listener.InMemoryListenerConfig;
import com.unboundid.ldap.listener.interceptor.InMemoryInterceptedSimpleBindRequest;
import com.unboundid.ldap.listener.interceptor.InMemoryOperationInterceptor;
import java.net.InetAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.sso.browser.SsoBrowser;
import org.openmetadata.it.sso.config.SecurityConfigSwap;
import org.openmetadata.it.sso.config.SecurityConfigSwap.Answer;
import org.openmetadata.it.sso.config.SsoConfigs;
import org.openmetadata.it.sso.oidc.MockOidcIdentity;
import org.openmetadata.it.sso.oidc.MockOidcProvider;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.system.SecurityValidationResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.saml.MockSamlIdp;

/**
 * Saving SSO settings. A save the server cannot apply is refused with its reason and leaves the
 * configuration it had, in the database as well as in memory, and a provider switch through PATCH
 * applies the new provider's settings instead of dropping them.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class SsoSecurityConfigApplyIT {
  private static final String IDP_ENTITY_ID = "https://idp.saml-apply-it.invalid";
  private static final String SP_ENTITY_ID = "openmetadata-saml-apply-it";
  private static final String LDAP_BASE_DN = "dc=example,dc=com";
  private static final String LDAP_USERS_DN = "ou=users," + LDAP_BASE_DN;
  private static final String LDAP_BIND_DN = "cn=Directory Manager";
  private static final String LDAP_BIND_PASSWORD = "bind-password";
  private static final String NOT_APPLIED = "could not be applied";
  private static final long WAIT_SECONDS = 60;

  private static MockOidcProvider provider;
  private static SecurityConfigSwap securityConfig;

  @BeforeAll
  static void startFromSaml() {
    assumeFalse(OssTestServer.isExternalMode(), "Reconfigures the embedded server's SSO");
    MockSamlIdp idp = new MockSamlIdp(IDP_ENTITY_ID);
    provider = MockOidcProvider.start();
    securityConfig = SecurityConfigSwap.snapshotLiveConfig();
    securityConfig.applyBaseline(
        SsoConfigs.saml(
            securityConfig.originalCopy(), IDP_ENTITY_ID, idp.idpCertificatePem(), SP_ENTITY_ID));
  }

  @AfterAll
  static void restoreTheLiveConfiguration() {
    if (securityConfig != null) {
      securityConfig.close();
    }
    if (provider != null) {
      provider.close();
    }
  }

  @Test
  @DisplayName("CF-02 a provider switch through PATCH applies the new provider's settings")
  void providerSwitchThroughPatchAppliesTheNewProvidersSettings(TestNamespace ns) {
    SecurityConfiguration saved = SecurityConfigSwap.maskedLiveConfig();
    SecurityConfiguration switched = SsoConfigs.confidentialOidc(saved, provider);
    String patch = JsonUtils.getJsonPatch(saved, switched).toJsonArray().toString();
    try {
      Answer answer = SecurityConfigSwap.attemptPatch(patch);

      assertEquals(204, answer.status(), answer.body());
      AuthenticationConfiguration live = SecurityConfigurationManager.getCurrentAuthConfig();
      assertEquals(provider.profile().provider(), live.getProvider());
      assertEquals(ClientType.CONFIDENTIAL, live.getClientType());
      assertEquals(provider.discoveryUri(), live.getOidcConfiguration().getDiscoveryUri());
      provider.signIn(MockOidcIdentity.forEmail(ns.shortPrefix("switched") + "@open-metadata.org"));
      idTokenFrom(login(new SsoBrowser()));
    } finally {
      securityConfig.restoreBaseline();
    }
  }

  @Test
  @DisplayName("CF-02 a client type change while SAML is saved is refused with the reason")
  void clientTypeChangeWhileSamlIsSavedIsRefused() {
    JsonNode stored = SecurityConfigSwap.storedConfig();
    try {
      Answer answer =
          SecurityConfigSwap.attemptPatch(
              "[{\"op\":\"replace\",\"path\":\"/authenticationConfiguration/clientType\","
                  + "\"value\":\"confidential\"}]");

      assertEquals(400, answer.status(), answer.body());
      assertTrue(answer.body().contains("clientType"), answer.body());
      assertEquals(stored, SecurityConfigSwap.storedConfig());
    } finally {
      securityConfig.restoreBaseline();
    }
  }

  @Test
  @DisplayName("CF-03 an LDAP configuration whose bind fails is refused, and nothing is saved")
  void ldapConfigurationThatCannotBindIsNotSaved() throws Exception {
    InMemoryDirectoryServer directory = startDirectory();
    try {
      assertRefusedAndNothingSaved(
          SsoConfigs.ldap(
              securityConfig.originalCopy(),
              directory.getListenPort(),
              LDAP_BIND_DN,
              "not-the-bind-password",
              LDAP_USERS_DN));
    } finally {
      directory.shutDown(true);
    }
  }

  /**
   * The keystore's path, alias and password are all set, so the check made before anything is
   * written passes; the file is not a keystore, so applying the stored save fails and it is put
   * back.
   */
  @Test
  @DisplayName("CF-03 a SAML keystore the server cannot load is refused, and nothing is saved")
  void samlKeyStoreThatCannotBeLoadedIsNotSaved(@TempDir Path directory) throws Exception {
    Path notAKeyStore = Files.writeString(directory.resolve("saml-sp.jks"), "not a keystore");
    SecurityConfiguration broken = securityConfig.baselineCopy();
    broken
        .getAuthenticationConfiguration()
        .getSamlConfiguration()
        .getSecurity()
        .withSendSignedAuthRequest(true)
        .withKeyStoreFilePath(notAKeyStore.toString())
        .withKeyStoreAlias("sp")
        .withKeyStorePassword("keystore-password");

    Answer put = assertRefusedAndNothingSaved(broken);

    assertTrue(put.body().contains(NOT_APPLIED), "refused before it was stored: " + put.body());
  }

  /**
   * Another server's save lands while this one waits on a slow directory. When the bind then
   * fails, putting the previous configuration back would undo a save its admin was told
   * succeeded, so that save is kept and this one is answered 412.
   */
  @Test
  @DisplayName("CF-03 a save made while a refused one waits on the directory is kept")
  void aSaveMadeWhileARefusedOneWaitsOnTheDirectoryIsKept() throws Exception {
    HeldBind heldBind = new HeldBind();
    InMemoryDirectoryServer directory = startDirectory(heldBind);
    ExecutorService admin = Executors.newSingleThreadExecutor();
    try {
      SecurityConfiguration cannotBind =
          SsoConfigs.ldap(
              securityConfig.originalCopy(),
              directory.getListenPort(),
              LDAP_BIND_DN,
              "not-the-bind-password",
              LDAP_USERS_DN);
      Future<Answer> refused = admin.submit(() -> SecurityConfigSwap.attemptPut(cannotBind));
      assertTrue(heldBind.reached(), "the save never reached the directory");

      SecurityConfiguration savedMeanwhile = securityConfig.baselineCopy();
      savedMeanwhile.getAuthorizerConfiguration().getAdminPrincipals().add("saved-meanwhile");
      saveAsAnotherServer(savedMeanwhile);
      JsonNode keptSave = SecurityConfigSwap.storedConfig();
      heldBind.answer();

      Answer answer = refused.get(WAIT_SECONDS, TimeUnit.SECONDS);
      assertEquals(412, answer.status(), answer.body());
      assertTrue(answer.body().contains(NOT_APPLIED), answer.body());
      assertEquals(
          keptSave, SecurityConfigSwap.storedConfig(), "the save made meanwhile was undone");
    } finally {
      heldBind.answer();
      admin.shutdownNow();
      directory.shutDown(true);
      securityConfig.restoreBaseline();
    }
  }

  @Test
  @DisplayName("LD-12 LDAPS without a trust store type is refused at save with the reason")
  void ldapsWithoutATrustStoreTypeIsRefusedAtSave() throws Exception {
    InMemoryDirectoryServer directory = startDirectory();
    try {
      SecurityConfiguration ldaps =
          SsoConfigs.ldap(
              securityConfig.originalCopy(),
              directory.getListenPort(),
              LDAP_BIND_DN,
              LDAP_BIND_PASSWORD,
              LDAP_USERS_DN);
      ldaps
          .getAuthenticationConfiguration()
          .getLdapConfiguration()
          .withSslEnabled(true)
          .withTruststoreConfigType(null)
          .withTrustStoreConfig(null);

      Answer put = assertRefusedAndNothingSaved(ldaps);
      assertTrue(mentionsTheTrustStore(put.body()), put.body());
      Answer validate = SecurityConfigSwap.attemptValidate(ldaps);
      assertEquals(200, validate.status(), validate.body());
      SecurityValidationResponse result =
          JsonUtils.readValue(validate.body(), SecurityValidationResponse.class);
      assertEquals(SecurityValidationResponse.Status.FAILED, result.getStatus(), validate.body());
      assertTrue(mentionsTheTrustStore(validate.body()), validate.body());
    } finally {
      directory.shutDown(true);
    }
  }

  /**
   * The save is refused with a 400, neither the database nor the server took it, and the
   * configuration an administrator reads is still the previous one.
   */
  private static Answer assertRefusedAndNothingSaved(SecurityConfiguration refused) {
    JsonNode stored = SecurityConfigSwap.storedConfig();
    JsonNode live = SecurityConfigSwap.liveConfig();
    JsonNode read = JsonUtils.valueToTree(SecurityConfigSwap.maskedLiveConfig());
    try {
      Answer answer = SecurityConfigSwap.attemptPut(refused);

      assertEquals(400, answer.status(), answer.body());
      assertEquals(stored, SecurityConfigSwap.storedConfig(), "the refused save was stored");
      assertEquals(live, SecurityConfigSwap.liveConfig(), "the server runs the refused save");
      assertEquals(
          read, JsonUtils.valueToTree(SecurityConfigSwap.maskedLiveConfig()), "reads changed");
      return answer;
    } finally {
      securityConfig.restoreBaseline();
    }
  }

  /** What another server's save does to the database, compared and set like any save. */
  private static void saveAsAnotherServer(SecurityConfiguration config) {
    SystemRepository repository = Entity.getSystemRepository();
    repository.updateSecurityConfigurationIfCurrent(
        config, repository.getStoredSecurityConfiguration());
  }

  private static boolean mentionsTheTrustStore(String body) {
    return body.toLowerCase(Locale.ROOT).contains("trust store");
  }

  private static InMemoryDirectoryServer startDirectory(
      InMemoryOperationInterceptor... interceptors) throws Exception {
    InMemoryDirectoryServerConfig config = new InMemoryDirectoryServerConfig(LDAP_BASE_DN);
    config.addAdditionalBindCredentials(LDAP_BIND_DN, LDAP_BIND_PASSWORD);
    for (InMemoryOperationInterceptor interceptor : interceptors) {
      config.addInMemoryOperationInterceptor(interceptor);
    }
    config.setListenerConfigs(
        InMemoryListenerConfig.createLDAPConfig(
            "default", InetAddress.getLoopbackAddress(), 0, null));
    config.setSchema(null);
    InMemoryDirectoryServer directory = new InMemoryDirectoryServer(config);
    directory.add("dn: " + LDAP_BASE_DN, "objectClass: domain", "dc: example");
    directory.add("dn: " + LDAP_USERS_DN, "objectClass: organizationalUnit", "ou: users");
    directory.startListening();
    return directory;
  }

  /** Holds the directory's answer to the first bind until the test lets it go, as a slow one. */
  private static final class HeldBind extends InMemoryOperationInterceptor {
    private final CountDownLatch reached = new CountDownLatch(1);
    private final CountDownLatch answer = new CountDownLatch(1);
    private final AtomicBoolean held = new AtomicBoolean();

    @Override
    public void processSimpleBindRequest(InMemoryInterceptedSimpleBindRequest request) {
      if (held.compareAndSet(false, true)) {
        reached.countDown();
        try {
          answer.await(WAIT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
        }
      }
    }

    boolean reached() throws InterruptedException {
      return reached.await(WAIT_SECONDS, TimeUnit.SECONDS);
    }

    void answer() {
      answer.countDown();
    }
  }
}
