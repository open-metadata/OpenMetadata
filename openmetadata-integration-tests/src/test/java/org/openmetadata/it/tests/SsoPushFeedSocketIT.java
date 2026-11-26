package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.sso.browser.PushFeedSocket.SERVER_DISCONNECT;
import static org.openmetadata.it.sso.browser.PushFeedSocket.TOKEN_EXPIRED_CHANNEL;
import static org.openmetadata.it.sso.browser.PushFeedSocket.disconnectedBy;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.sso.browser.PushFeedSocket;
import org.openmetadata.it.sso.config.SecurityConfigSwap;
import org.openmetadata.it.sso.config.SsoConfigs;
import org.openmetadata.it.sso.config.SsoServer;
import org.openmetadata.it.sso.oidc.MockOidcIdentity;
import org.openmetadata.it.sso.oidc.MockOidcProvider;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;

/**
 * Public-client OIDC push feed: the single-page app opens its socket with the provider's ID token
 * and no session, so nothing but the token and the user bound it once it is open (#38245).
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class SsoPushFeedSocketIT {
  private static final String EMAIL_DOMAIN = "@open-metadata.org";
  private static final String SWEEP_INTERVAL_PROPERTY =
      "openmetadata.websocketSessionValidationIntervalSeconds";
  private static final long DEFAULT_SWEEP_INTERVAL_SECONDS = 60;
  private static final Duration SWEEP_MARGIN = Duration.ofSeconds(30);
  private static final Duration SHORT_LIFETIME = Duration.ofSeconds(5);
  private static final Duration LONG_LIFETIME = Duration.ofMinutes(10);

  /** Shorter than one sweep, so a close this quick came from the delete, not from a sweep. */
  private static final Duration DELETE_CLOSE_DEADLINE = Duration.ofSeconds(10);

  private static MockOidcProvider provider;
  private static SecurityConfigSwap securityConfig;

  @BeforeAll
  static void pointTheServerAtTheMockProvider() {
    assumeFalse(OssTestServer.isExternalMode(), "Reconfigures the embedded server's SSO");
    provider = MockOidcProvider.start();
    securityConfig = SecurityConfigSwap.snapshotLiveConfig();
    securityConfig.applyBaseline(SsoConfigs.publicOidc(securityConfig.originalCopy(), provider));
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
  @DisplayName("PF-01 a socket closes after its provider token expires, with a notice first")
  void socketClosesAfterItsProviderTokenExpires(TestNamespace ns) {
    SsoUser expiring = existingUser(ns, "xavier");
    SsoUser current = existingUser(ns, "yvonne");

    try (PushFeedSocket expiringSocket = openFor(expiring, SHORT_LIFETIME);
        PushFeedSocket currentSocket = openFor(current, LONG_LIFETIME)) {
      Awaitility.await("the socket whose token expired is closed")
          .atMost(sweepInterval().plus(SHORT_LIFETIME).plus(SWEEP_MARGIN))
          .until(() -> !expiringSocket.isConnected());

      assertEquals(
          List.of(TOKEN_EXPIRED_CHANNEL, disconnectedBy(SERVER_DISCONNECT)),
          expiringSocket.received());
      assertTrue(currentSocket.isConnected(), "the sweep left the socket with a valid token open");
      assertEquals(List.of(), currentSocket.received());
    }
  }

  @Test
  @DisplayName("PF-02 soft deleting a user closes their socket at once and no one else's")
  void softDeleteClosesTheUsersSocketAtOnce(TestNamespace ns) {
    SsoUser deleted = existingUser(ns, "walter");
    SsoUser other = existingUser(ns, "zelda");

    try (PushFeedSocket deletedSocket = openFor(deleted, LONG_LIFETIME);
        PushFeedSocket otherSocket = openFor(other, LONG_LIFETIME)) {
      SdkClients.adminClient().users().delete(deleted.id());

      awaitClosedByTheDelete(deletedSocket);
      assertEquals(List.of(disconnectedBy(SERVER_DISCONNECT)), deletedSocket.received());
      assertTrue(otherSocket.isConnected(), "another user's socket stays open");
    }
  }

  @Test
  @DisplayName("PF-03 a restored user's old socket stays closed and a new one connects")
  void restoredUserConnectsANewSocket(TestNamespace ns) {
    SsoUser restored = existingUser(ns, "victor");

    try (PushFeedSocket beforeDelete = openFor(restored, LONG_LIFETIME)) {
      SdkClients.adminClient().users().delete(restored.id());
      awaitClosedByTheDelete(beforeDelete);
      SdkClients.adminClient().users().restore(restored.id());

      try (PushFeedSocket afterRestore = openFor(restored, LONG_LIFETIME)) {
        assertTrue(afterRestore.isConnected(), "the restored user opens a socket again");
        assertFalse(beforeDelete.isConnected(), "the socket from before the delete stays closed");
      }
    }
  }

  @Test
  @DisplayName("PF-04 hard deleting a user closes their socket at once")
  void hardDeleteClosesTheUsersSocketAtOnce(TestNamespace ns) {
    SsoUser deleted = existingUser(ns, "ursula");

    try (PushFeedSocket socket = openFor(deleted, LONG_LIFETIME)) {
      SdkClients.adminClient()
          .users()
          .delete(deleted.id(), Map.of("hardDelete", "true", "recursive", "true"));

      awaitClosedByTheDelete(socket);
      assertEquals(List.of(disconnectedBy(SERVER_DISCONNECT)), socket.received());
    }
  }

  private static void awaitClosedByTheDelete(PushFeedSocket socket) {
    Awaitility.await("the deleted user's socket is closed")
        .atMost(DELETE_CLOSE_DEADLINE)
        .until(() -> !socket.isConnected());
  }

  private static PushFeedSocket openFor(SsoUser user, Duration tokenLifetime) {
    return PushFeedSocket.open(
        SsoServer.root(), provider.issueIdToken(user.identity(), tokenLifetime));
  }

  /** The embedded server reads the sweep interval from this property when it boots. */
  private static Duration sweepInterval() {
    return Duration.ofSeconds(
        Long.getLong(SWEEP_INTERVAL_PROPERTY, DEFAULT_SWEEP_INTERVAL_SECONDS));
  }

  private static SsoUser existingUser(TestNamespace ns, String name) {
    MockOidcIdentity identity = MockOidcIdentity.forEmail(ns.shortPrefix(name) + EMAIL_DOMAIN);
    String userName = identity.email().substring(0, identity.email().indexOf('@'));
    User user =
        SdkClients.adminClient()
            .users()
            .create(new CreateUser().withName(userName).withEmail(identity.email()));
    return new SsoUser(user, identity);
  }

  private record SsoUser(User user, MockOidcIdentity identity) {
    private String id() {
      return user.getId().toString();
    }
  }
}
