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

package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.util.RestUtil.PutResponse;
import sun.misc.Unsafe;

@Execution(ExecutionMode.CONCURRENT)
class AuthenticationCodeFlowHandlerTest {

  @Test
  void testResolveOidcIdentityFallsBackToLegacyClaimsWhenEmailClaimMissing() throws Exception {
    AuthenticationCodeFlowHandler handler =
        newHandler(true, List.of("preferred_username", "sub"), new ArrayList<>(), "email", "name");

    Object identity =
        invokePrivate(handler, "resolveOidcIdentity", Map.of("preferred_username", "legacy-user"));

    assertFalse((Boolean) invokeAccessor(identity, "emailFirstFlow"));
    assertEquals("legacy-user", invokeAccessor(identity, "userName"));
    assertEquals("legacy-user@openmetadata.org", invokeAccessor(identity, "email"));
  }

  @Test
  void testGetOrCreateEmailFirstOidcUserLooksUpExistingUsersByExactEmail() throws Exception {
    AuthenticationCodeFlowHandler handler =
        newHandler(true, List.of("preferred_username"), new ArrayList<>(), "email", "name");
    UserRepository userRepository = mock(UserRepository.class);
    User johnAtX =
        new User()
            .withId(UUID.randomUUID())
            .withName("john")
            .withEmail("john@x.com")
            .withDisplayName("John X")
            .withIsAdmin(false);
    User johnAtY =
        new User()
            .withId(UUID.randomUUID())
            .withName("john_a1b2")
            .withEmail("john@y.com")
            .withDisplayName("John Y")
            .withIsAdmin(false);

    when(userRepository.getActiveUserByEmailForAuth(eq("john@x.com"), any())).thenReturn(johnAtX);
    when(userRepository.getActiveUserByEmailForAuth(eq("john@y.com"), any())).thenReturn(johnAtY);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getUserRepository).thenReturn(userRepository);

      User resolvedX =
          (User)
              invokePrivate(
                  handler, "getOrCreateEmailFirstOidcUser", "john@x.com", "John X", Map.of());
      User resolvedY =
          (User)
              invokePrivate(
                  handler, "getOrCreateEmailFirstOidcUser", "john@y.com", "John Y", Map.of());

      assertSame(johnAtX, resolvedX);
      assertSame(johnAtY, resolvedY);
      verify(userRepository).getActiveUserByEmailForAuth(eq("john@x.com"), any());
      verify(userRepository).getActiveUserByEmailForAuth(eq("john@y.com"), any());
    }
  }

  @Test
  void testGetOrCreateEmailFirstOidcUserCreatesNewUserWhenSelfSignupEnabled() throws Exception {
    AuthenticationCodeFlowHandler handler =
        newHandler(true, List.of("preferred_username"), new ArrayList<>(), "email", "name");
    UserRepository userRepository = mock(UserRepository.class);

    when(userRepository.getActiveUserByEmailForAuth(eq("newuser@company.com"), any()))
        .thenThrow(EntityNotFoundException.byName("newuser@company.com"));
    when(userRepository.findByNameOrNull(anyString(), eq(Include.NON_DELETED))).thenReturn(null);
    when(userRepository.createOrUpdate(any(), any(User.class), anyString()))
        .thenAnswer(
            invocation ->
                new PutResponse<>(
                    Response.Status.CREATED,
                    invocation.<User>getArgument(1),
                    EventType.ENTITY_CREATED));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getUserRepository).thenReturn(userRepository);
      entityMock.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      entityMock
          .when(() -> Entity.getEntityByName(Entity.USER, "newuser", "id", Include.NON_DELETED))
          .thenThrow(EntityNotFoundException.byName("newuser"));

      User createdUser =
          (User)
              invokePrivate(
                  handler,
                  "getOrCreateEmailFirstOidcUser",
                  "newuser@company.com",
                  "New User",
                  Map.of());

      assertEquals("newuser", createdUser.getName());
      assertEquals("newuser@company.com", createdUser.getEmail());
      assertEquals("New User", createdUser.getDisplayName());
      assertTrue(Boolean.TRUE.equals(createdUser.getIsEmailVerified()));
    }
  }

  @Test
  void testGetOrCreateEmailFirstOidcUserRejectsUnregisteredUserWhenSelfSignupDisabled()
      throws Exception {
    AuthenticationCodeFlowHandler handler =
        newHandler(false, List.of("preferred_username"), new ArrayList<>(), "email", "name");
    UserRepository userRepository = mock(UserRepository.class);

    when(userRepository.getActiveUserByEmailForAuth(eq("newuser@company.com"), any()))
        .thenThrow(EntityNotFoundException.byName("newuser@company.com"));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getUserRepository).thenReturn(userRepository);

      org.openmetadata.service.exception.AuthenticationException exception =
          assertThrows(
              org.openmetadata.service.exception.AuthenticationException.class,
              () ->
                  invokePrivate(
                      handler,
                      "getOrCreateEmailFirstOidcUser",
                      "newuser@company.com",
                      "New User",
                      Map.of()));

      assertTrue(exception.getMessage().contains("User not registered"));
    }
  }

  private static AuthenticationCodeFlowHandler newHandler(
      boolean enableSelfSignup,
      List<String> principalClaims,
      List<String> principalClaimsMapping,
      String emailClaim,
      String displayNameClaim)
      throws Exception {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration()
            .withEnableSelfSignup(enableSelfSignup)
            .withJwtPrincipalClaims(principalClaims)
            .withJwtPrincipalClaimsMapping(principalClaimsMapping)
            .withEmailClaim(emailClaim)
            .withDisplayNameClaim(displayNameClaim);

    AuthorizerConfiguration authorizerConfig =
        new AuthorizerConfiguration()
            .withAdminPrincipals(Set.of())
            .withAllowedDomains(new HashSet<>())
            .withAllowedEmailDomains(Set.of())
            .withPrincipalDomain("openmetadata.org")
            .withEnforcePrincipalDomain(false);

    AuthenticationCodeFlowHandler handler =
        (AuthenticationCodeFlowHandler)
            getUnsafe().allocateInstance(AuthenticationCodeFlowHandler.class);
    setField(handler, "authenticationConfiguration", authConfig);
    setField(handler, "authorizerConfiguration", authorizerConfig);
    setField(handler, "claimsOrder", principalClaims);
    setField(handler, "claimsMapping", toClaimsMapping(principalClaimsMapping));
    setField(handler, "principalDomain", "openmetadata.org");
    return handler;
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

  private static Object invokeAccessor(Object target, String methodName) throws Exception {
    Method accessor = target.getClass().getDeclaredMethod(methodName);
    accessor.setAccessible(true);
    return accessor.invoke(target);
  }

  private static Map<String, String> toClaimsMapping(List<String> principalClaimsMapping) {
    return principalClaimsMapping.stream()
        .map(value -> value.split(":"))
        .collect(java.util.stream.Collectors.toMap(parts -> parts[0], parts -> parts[1]));
  }

  private static void setField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }

  private static Unsafe getUnsafe() throws Exception {
    Field theUnsafe = Unsafe.class.getDeclaredField("theUnsafe");
    theUnsafe.setAccessible(true);
    return (Unsafe) theUnsafe.get(null);
  }
}
