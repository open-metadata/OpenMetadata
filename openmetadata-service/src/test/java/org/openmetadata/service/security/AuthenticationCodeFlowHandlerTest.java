package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.util.RestUtil.PutResponse;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthenticationCodeFlowHandlerTest {

  @Test
  void getOrCreateOidcUser_selfSignup_persistsMappedEmailNotDerivedFromUsername() throws Exception {
    AuthenticationCodeFlowHandler handler = createSelfSignupHandler(null);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubUserNotFoundAndEchoCreate(mockedEntity);

      User created =
          invokeGetOrCreateOidcUser(handler, "shortid", "firstname.lastname@example.com");

      assertEquals("shortid", created.getName());
      assertEquals("firstname.lastname@example.com", created.getEmail());
    }
  }

  @Test
  void getOrCreateOidcUser_selfSignup_preservesEmailWhenUsernameMatchesLocalPart()
      throws Exception {
    AuthenticationCodeFlowHandler handler = createSelfSignupHandler(null);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubUserNotFoundAndEchoCreate(mockedEntity);

      User created = invokeGetOrCreateOidcUser(handler, "john.doe", "john.doe@example.com");

      assertEquals("john.doe", created.getName());
      assertEquals("john.doe@example.com", created.getEmail());
    }
  }

  @Test
  void getOrCreateOidcUser_selfSignup_allowsConfiguredDomainAndPersistsMappedEmail()
      throws Exception {
    AuthenticationCodeFlowHandler handler = createSelfSignupHandler(Set.of("example.com"));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubUserNotFoundAndEchoCreate(mockedEntity);

      User created =
          invokeGetOrCreateOidcUser(handler, "shortid", "firstname.lastname@example.com");

      assertEquals("shortid", created.getName());
      assertEquals("firstname.lastname@example.com", created.getEmail());
    }
  }

  @Test
  void getOrCreateOidcUser_selfSignup_rejectsDisallowedEmailDomain() throws Exception {
    AuthenticationCodeFlowHandler handler = createSelfSignupHandler(Set.of("allowed.com"));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubUserNotFoundAndEchoCreate(mockedEntity);

      AuthenticationException thrown =
          assertThrows(
              AuthenticationException.class,
              () ->
                  invokeGetOrCreateOidcUser(handler, "shortid", "firstname.lastname@example.com"));

      assertTrue(thrown.getMessage().contains("example.com"));
    }
  }

  private AuthenticationCodeFlowHandler createSelfSignupHandler(Set<String> allowedDomains)
      throws Exception {
    AuthenticationConfiguration authConfig = mock(AuthenticationConfiguration.class);
    when(authConfig.getEnableSelfSignup()).thenReturn(true);

    AuthorizerConfiguration authzConfig = mock(AuthorizerConfiguration.class);
    when(authzConfig.getAdminPrincipals()).thenReturn(Set.of());
    when(authzConfig.getAllowedEmailRegistrationDomains()).thenReturn(allowedDomains);
    when(authzConfig.getDefaultOAuthRole()).thenReturn(null);

    sun.misc.Unsafe unsafe = getUnsafe();
    AuthenticationCodeFlowHandler handler =
        (AuthenticationCodeFlowHandler)
            unsafe.allocateInstance(AuthenticationCodeFlowHandler.class);
    setField(handler, "authenticationConfiguration", authConfig);
    setField(handler, "authorizerConfiguration", authzConfig);
    return handler;
  }

  private void stubUserNotFoundAndEchoCreate(MockedStatic<Entity> mockedEntity) {
    UserRepository userRepository = mock(UserRepository.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);

    mockedEntity
        .when(
            () ->
                Entity.getEntityByName(
                    eq(Entity.USER), anyString(), anyString(), any(Include.class)))
        .thenThrow(new EntityNotFoundException("user not found"));
    mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
    mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

    when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);
    when(userRepository.findByNameOrNull(any(), any())).thenReturn(null);
    when(userRepository.createOrUpdate(eq(null), any(User.class), any()))
        .thenAnswer(
            invocation ->
                new PutResponse<>(
                    Response.Status.CREATED,
                    invocation.getArgument(1, User.class),
                    EventType.ENTITY_CREATED));
  }

  private User invokeGetOrCreateOidcUser(
      AuthenticationCodeFlowHandler handler, String userName, String email) throws Exception {
    Method method =
        AuthenticationCodeFlowHandler.class.getDeclaredMethod(
            "getOrCreateOidcUser", String.class, String.class, Map.class);
    method.setAccessible(true);
    User result;
    try {
      result = (User) method.invoke(handler, userName, email, new HashMap<String, Object>());
    } catch (InvocationTargetException e) {
      Throwable cause = e.getCause();
      if (cause instanceof RuntimeException runtimeException) {
        throw runtimeException;
      }
      throw e;
    }
    return result;
  }

  private static sun.misc.Unsafe getUnsafe() throws Exception {
    Field unsafeField = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    unsafeField.setAccessible(true);
    return (sun.misc.Unsafe) unsafeField.get(null);
  }

  private static void setField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
