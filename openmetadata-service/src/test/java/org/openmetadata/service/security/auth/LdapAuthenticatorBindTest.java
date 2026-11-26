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

package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mockStatic;

import com.unboundid.ldap.listener.InMemoryDirectoryServer;
import com.unboundid.ldap.listener.InMemoryDirectoryServerConfig;
import com.unboundid.ldap.listener.InMemoryListenerConfig;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.net.InetAddress;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.security.SecurityUtil;

/**
 * Wrong LDAP passwords must count towards the login lockout. UnboundID rejects a bind by throwing,
 * so the result-code branch that recorded the failure was never reached.
 */
class LdapAuthenticatorBindTest {
  private static final String BASE_DN = "dc=example,dc=com";
  private static final String USER_DN = "uid=jane,ou=users," + BASE_DN;
  private static final String PASSWORD = "right-password";

  private static InMemoryDirectoryServer directory;
  private final LdapAuthenticator authenticator = new LdapAuthenticator();
  private final User account =
      new User().withName("jane").withEmail("jane+" + UUID.randomUUID() + "@example.com");
  private LoginAttemptCache previousCache;
  private MockedStatic<SecurityUtil> securityUtil;

  @BeforeAll
  static void startDirectory() throws Exception {
    InMemoryDirectoryServerConfig config = new InMemoryDirectoryServerConfig(BASE_DN);
    config.setListenerConfigs(
        InMemoryListenerConfig.createLDAPConfig(
            "default", InetAddress.getLoopbackAddress(), 0, null));
    config.setSchema(null);
    directory = new InMemoryDirectoryServer(config);
    directory.add("dn: " + BASE_DN, "objectClass: domain", "dc: example");
    directory.add("dn: ou=users," + BASE_DN, "objectClass: organizationalUnit", "ou: users");
    directory.add(
        "dn: " + USER_DN, "objectClass: inetOrgPerson", "uid: jane", "userPassword: " + PASSWORD);
    directory.startListening();
  }

  @AfterAll
  static void stopDirectory() {
    directory.shutDown(true);
  }

  @BeforeEach
  void setUp() throws Exception {
    LdapConfiguration ldap =
        new LdapConfiguration()
            .withHost(InetAddress.getLoopbackAddress().getHostAddress())
            .withPort(directory.getListenPort())
            .withSslEnabled(false);
    Field ldapField = LdapAuthenticator.class.getDeclaredField("ldapConfiguration");
    ldapField.setAccessible(true);
    ldapField.set(authenticator, ldap);
    previousCache = swapLoginAttemptCache(new LoginAttemptCache(3, 600));
    securityUtil = mockStatic(SecurityUtil.class, CALLS_REAL_METHODS);
    securityUtil
        .when(SecurityUtil::getLoginConfiguration)
        .thenReturn(new LoginConfiguration().withMaxLoginFailAttempts(3).withAccessBlockTime(600));
  }

  @AfterEach
  void tearDown() throws Exception {
    securityUtil.close();
    swapLoginAttemptCache(previousCache);
  }

  @Test
  void aWrongPasswordIsRejectedAndCountsTowardsTheLockout() {
    CustomExceptionMessage refused =
        assertThrows(
            CustomExceptionMessage.class,
            () -> authenticator.validatePassword(USER_DN, "wrong-password", account));

    assertEquals(Response.Status.UNAUTHORIZED.getStatusCode(), refused.getResponse().getStatus());
    assertEquals(1, LoginAttemptCache.getInstance().getUserFailedLoginCount(account.getEmail()));
  }

  @Test
  void theRightPasswordClearsEarlierFailures() {
    assertThrows(
        CustomExceptionMessage.class,
        () -> authenticator.validatePassword(USER_DN, "wrong-password", account));

    assertDoesNotThrow(() -> authenticator.validatePassword(USER_DN, PASSWORD, account));
    assertEquals(0, LoginAttemptCache.getInstance().getUserFailedLoginCount(account.getEmail()));
  }

  private static LoginAttemptCache swapLoginAttemptCache(LoginAttemptCache replacement)
      throws Exception {
    Field instance = LoginAttemptCache.class.getDeclaredField("INSTANCE");
    instance.setAccessible(true);
    LoginAttemptCache previous = (LoginAttemptCache) instance.get(null);
    instance.set(null, replacement);
    return previous;
  }
}
