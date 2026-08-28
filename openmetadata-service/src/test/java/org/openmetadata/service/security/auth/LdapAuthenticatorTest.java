/*
 *  Copyright 2021 Collate
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.util.RestUtil.PutResponse;

@Execution(ExecutionMode.CONCURRENT)
class LdapAuthenticatorTest {

  @Test
  void testGetOrCreateLdapUserLooksUpExistingUsersByExactEmail() throws Exception {
    LdapAuthenticator authenticator = newAuthenticator(true);
    UserRepository userRepository = mock(UserRepository.class);
    User existingUser =
        new User()
            .withId(UUID.randomUUID())
            .withName("john_a1b2")
            .withEmail("john@y.com")
            .withDisplayName("John Y")
            .withIsAdmin(false);

    setField(authenticator, "userRepository", userRepository);
    when(userRepository.getActiveUserByEmailForAuth(eq("john@y.com"), any()))
        .thenReturn(existingUser);

    try (MockedStatic<SecurityConfigurationManager> securityConfigMock =
        mockStatic(SecurityConfigurationManager.class)) {
      securityConfigMock
          .when(SecurityConfigurationManager::getCurrentAuthzConfig)
          .thenReturn(newAuthorizerConfiguration());

      User resolvedUser =
          (User)
              invokePrivate(
                  authenticator,
                  "getOrCreateLdapUser",
                  "uid=john,ou=people,dc=test,dc=com",
                  "john@y.com",
                  "John Y");

      assertSame(existingUser, resolvedUser);
      verify(userRepository).getActiveUserByEmailForAuth(eq("john@y.com"), any());
    }
  }

  @Test
  void testGetOrCreateLdapUserCreatesNewUserWhenSelfSignupEnabled() throws Exception {
    LdapAuthenticator authenticator = newAuthenticator(true);
    UserRepository userRepository = mock(UserRepository.class);

    setField(authenticator, "userRepository", userRepository);
    when(userRepository.getActiveUserByEmailForAuth(eq("ldapuser@company.com"), any()))
        .thenThrow(EntityNotFoundException.byName("ldapuser@company.com"));
    when(userRepository.findByNameOrNull(anyString(), eq(Include.NON_DELETED))).thenReturn(null);
    when(userRepository.createOrUpdate(any(), any(User.class), anyString()))
        .thenAnswer(
            invocation ->
                new PutResponse<>(
                    Response.Status.CREATED,
                    invocation.<User>getArgument(1),
                    EventType.ENTITY_CREATED));

    try (MockedStatic<SecurityConfigurationManager> securityConfigMock =
            mockStatic(SecurityConfigurationManager.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      securityConfigMock
          .when(SecurityConfigurationManager::getCurrentAuthzConfig)
          .thenReturn(newAuthorizerConfiguration());
      entityMock.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      entityMock
          .when(() -> Entity.getEntityByName(Entity.USER, "ldapuser", "id", Include.NON_DELETED))
          .thenThrow(EntityNotFoundException.byName("ldapuser"));

      User createdUser =
          (User)
              invokePrivate(
                  authenticator,
                  "getOrCreateLdapUser",
                  "uid=ldapuser,ou=people,dc=test,dc=com",
                  "ldapuser@company.com",
                  "LDAP User");

      assertEquals("ldapuser", createdUser.getName());
      assertEquals("ldapuser@company.com", createdUser.getEmail());
      assertEquals("LDAP User", createdUser.getDisplayName());
      assertTrue(Boolean.TRUE.equals(createdUser.getIsEmailVerified()));
    }
  }

  @Test
  void testGetOrCreateLdapUserRejectsUnregisteredUserWhenSelfSignupDisabled() throws Exception {
    LdapAuthenticator authenticator = newAuthenticator(false);
    UserRepository userRepository = mock(UserRepository.class);

    setField(authenticator, "userRepository", userRepository);
    when(userRepository.getActiveUserByEmailForAuth(eq("ldapuser@company.com"), any()))
        .thenThrow(EntityNotFoundException.byName("ldapuser@company.com"));

    try (MockedStatic<SecurityConfigurationManager> securityConfigMock =
        mockStatic(SecurityConfigurationManager.class)) {
      securityConfigMock
          .when(SecurityConfigurationManager::getCurrentAuthzConfig)
          .thenReturn(newAuthorizerConfiguration());

      AuthenticationException exception =
          assertThrows(
              AuthenticationException.class,
              () ->
                  invokePrivate(
                      authenticator,
                      "getOrCreateLdapUser",
                      "uid=ldapuser,ou=people,dc=test,dc=com",
                      "ldapuser@company.com",
                      "LDAP User"));

      assertTrue(exception.getMessage().contains("User not registered"));
    }
  }

  private static LdapAuthenticator newAuthenticator(boolean selfSignupEnabled) throws Exception {
    LdapAuthenticator authenticator = new LdapAuthenticator();
    setField(authenticator, "isSelfSignUpEnabled", selfSignupEnabled);
    setField(authenticator, "ldapConfiguration", mock(LdapConfiguration.class));
    return authenticator;
  }

  private static AuthorizerConfiguration newAuthorizerConfiguration() {
    return new AuthorizerConfiguration()
        .withAdminPrincipals(Set.of())
        .withAllowedDomains(new HashSet<>())
        .withAllowedEmailDomains(Set.of())
        .withPrincipalDomain("openmetadata.org")
        .withEnforcePrincipalDomain(false);
  }

  private static void setField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }

  private static Object invokePrivate(Object target, String methodName, Object... args)
      throws Exception {
    Method method = findMethod(target.getClass(), methodName, args.length);
    method.setAccessible(true);
    try {
      return method.invoke(target, args);
    } catch (InvocationTargetException e) {
      Throwable cause = e.getCause();
      if (cause instanceof Exception exception) {
        throw exception;
      }
      if (cause instanceof Error error) {
        throw error;
      }
      throw e;
    }
  }

  private static Method findMethod(Class<?> type, String methodName, int arity) {
    for (Method method : type.getDeclaredMethods()) {
      if (method.getName().equals(methodName) && method.getParameterCount() == arity) {
        return method;
      }
    }
    throw new IllegalArgumentException("Method not found: " + methodName);
  }
}
