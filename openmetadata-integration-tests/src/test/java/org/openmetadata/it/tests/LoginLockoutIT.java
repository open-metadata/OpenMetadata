package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.exception.CatalogExceptionMessage.MAX_FAILED_LOGIN_ATTEMPT;
import static org.openmetadata.service.jdbi3.UserRepository.AUTH_MECHANISM_FIELD;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.ChangePasswordRequest;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.auth.BasicAuthenticator;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.UserUtil;

/**
 * A user who has forgotten their password has usually locked the account by the time an admin
 * resets it. The new password has to work on the very next login, whichever server serves it and
 * whichever process stored the new password.
 *
 * <p>Logins go over HTTP to the login servlet, which runs the basic authenticator. This suite's
 * server runs the {@code openmetadata} provider, whose REST password endpoints are not backed by
 * that authenticator, so the admin reset calls it in-process instead.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class LoginLockoutIT {
  private static final String WRONG_PASSWORD = "Wr0ng!Passw0rd";

  @Test
  void anAdminResetLetsALockedOutUserSignInWithTheNewPassword(TestNamespace ns) throws Exception {
    String oldPassword = "Old!Passw0rd" + ns.uniqueShortId();
    User user = createUser(ns, oldPassword);
    lockOut(user);
    assertLockedOut(user, oldPassword);

    String newPassword = "New!Passw0rd" + ns.uniqueShortId();
    adminResetsPassword(user, newPassword);

    assertEquals(200, login(user, newPassword).statusCode());
    assertEquals(401, login(user, oldPassword).statusCode());
  }

  @Test
  void aPasswordResetOutsideTheServerLetsALockedOutUserSignIn(TestNamespace ns) throws Exception {
    String oldPassword = "Old!Passw0rd" + ns.uniqueShortId();
    User user = createUser(ns, oldPassword);
    lockOut(user);
    assertLockedOut(user, oldPassword);

    String newPassword = "New!Passw0rd" + ns.uniqueShortId();
    resetPasswordLikeTheOpsCli(user, newPassword);

    assertEquals(200, login(user, newPassword).statusCode());
  }

  @Test
  void aCorrectPasswordClearsTheFailuresBeforeIt(TestNamespace ns) throws Exception {
    String password = "Right!Passw0rd" + ns.uniqueShortId();
    User user = createUser(ns, password);

    failLogins(user, maxLoginFailAttempts() - 1);
    assertEquals(200, login(user, password).statusCode());
    failLogins(user, maxLoginFailAttempts() - 1);

    assertEquals(200, login(user, password).statusCode());
  }

  /** The MCP login form checks the lockout by address, before it loads the account. */
  @Test
  void theLockoutCheckByAddressLiftsWithANewPassword(TestNamespace ns) throws Exception {
    String oldPassword = "Old!Passw0rd" + ns.uniqueShortId();
    User user = createUser(ns, oldPassword);
    lockOut(user);
    BasicAuthenticator authenticator = basicAuthenticator();
    assertThrows(
        AuthenticationException.class, () -> authenticator.checkIfLoginBlocked(user.getEmail()));

    adminResetsPassword(user, "New!Passw0rd" + ns.uniqueShortId());

    assertDoesNotThrow(() -> authenticator.checkIfLoginBlocked(user.getEmail()));
  }

  private static User createUser(TestNamespace ns, String password) {
    String name = ns.shortPrefix("lockout");
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(name)
                .withEmail(name + "@example.com")
                .withPassword(password)
                .withConfirmPassword(password)
                .withCreatePasswordType(CreateUser.CreatePasswordType.ADMIN_CREATE)
                .withIsBot(false));
  }

  private static void lockOut(User user) throws Exception {
    failLogins(user, maxLoginFailAttempts());
  }

  private static void failLogins(User user, int attempts) throws Exception {
    for (int attempt = 0; attempt < attempts; attempt++) {
      assertEquals(401, login(user, WRONG_PASSWORD).statusCode());
    }
  }

  private static int maxLoginFailAttempts() {
    return SecurityUtil.getLoginConfiguration().getMaxLoginFailAttempts();
  }

  private static void assertLockedOut(User user, String rightPassword) throws Exception {
    HttpResponse<String> response = login(user, rightPassword);
    assertEquals(401, response.statusCode());
    assertTrue(response.body().contains(MAX_FAILED_LOGIN_ATTEMPT), response.body());
  }

  private static BasicAuthenticator basicAuthenticator() {
    BasicAuthenticator authenticator = new BasicAuthenticator();
    authenticator.init(TestSuiteBootstrap.createApplicationConfigCopy());
    return authenticator;
  }

  private static void adminResetsPassword(User user, String newPassword) throws Exception {
    basicAuthenticator()
        .changeUserPwdWithOldPwd(
            null,
            user.getName(),
            new ChangePasswordRequest()
                .withUsername(user.getName())
                .withRequestType(ChangePasswordRequest.RequestType.USER)
                .withNewPassword(newPassword)
                .withConfirmPassword(newPassword));
  }

  /** The same writes as {@code openmetadata-ops reset-password}, which runs in its own process. */
  private static void resetPasswordLikeTheOpsCli(User user, String newPassword) {
    UserRepository users = Entity.getUserRepository();
    Set<String> fields = new HashSet<>(users.getPatchFields().getFieldList());
    fields.add(AUTH_MECHANISM_FIELD);
    User stored = users.getByEmail(null, user.getEmail(), new EntityUtil.Fields(fields));
    User updated = JsonUtils.deepCopy(stored, User.class);
    UserUtil.updateUserWithHashedPwd(updated, newPassword);
    UserUtil.addOrUpdateUser(updated);
  }

  private static HttpResponse<String> login(User user, String password) throws Exception {
    LoginRequest request =
        new LoginRequest()
            .withEmail(user.getEmail())
            .withPassword(
                Base64.getEncoder().encodeToString(password.getBytes(StandardCharsets.UTF_8)));
    // A fresh client per POST: a pooled connection the server already closed fails a POST, and the
    // JDK only retries GET and HEAD.
    return HttpClient.newHttpClient()
        .send(
            HttpRequest.newBuilder(URI.create(SdkClients.getServerUrl() + "/v1/auth/login"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(JsonUtils.pojoToJson(request)))
                .build(),
            HttpResponse.BodyHandlers.ofString());
  }
}
