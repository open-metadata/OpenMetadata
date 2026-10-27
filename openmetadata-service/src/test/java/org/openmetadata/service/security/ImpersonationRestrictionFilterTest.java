package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ResourceInfo;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class ImpersonationRestrictionFilterTest {

  @Test
  void identityEndpointsAreBoundToTheFilter() {
    // Impersonation lasts one request; a credential it reads, mints or revokes outlives the grant,
    // so the whole identity surface is off-limits while the principal has been swapped. Removing
    // the annotation from any of these reopens that surface.
    Set<String> expected =
        Set.of(
            "generateRandomPassword",
            "logoutUser",
            "generateToken",
            "generateTokenWithId",
            "revokeToken",
            "getToken",
            "getAuthenticationMechanism",
            "changeUserPassword",
            "getPersonalAccessToken",
            "revokePersonalAccessToken",
            "createAccessToken");

    assertEquals(expected, identityEndpoints(UserResource.class));
  }

  @Test
  void impersonatedRequestIsDenied() throws ReflectiveOperationException {
    ImpersonationRestrictionFilter filter = filterBoundTo("createAccessToken");

    AuthorizationException denied =
        assertThrows(
            AuthorizationException.class,
            () -> filter.filter(request(securityContext("alice", "impersonating-bot"))));

    assertTrue(denied.getMessage().contains("identity endpoint UserResource.createAccessToken"));
  }

  @Test
  void directRequestIsAllowed() throws ReflectiveOperationException {
    ImpersonationRestrictionFilter filter = filterBoundTo("createAccessToken");

    assertDoesNotThrow(() -> filter.filter(request(securityContext("alice", null))));
  }

  private static Set<String> identityEndpoints(Class<?> resource) {
    return Arrays.stream(resource.getDeclaredMethods())
        .filter(method -> method.isAnnotationPresent(IdentityEndpoint.class))
        .map(Method::getName)
        .collect(Collectors.toSet());
  }

  private static ImpersonationRestrictionFilter filterBoundTo(String methodName)
      throws ReflectiveOperationException {
    Method method =
        Arrays.stream(UserResource.class.getDeclaredMethods())
            .filter(candidate -> candidate.getName().equals(methodName))
            .findFirst()
            .orElseThrow();
    ResourceInfo resourceInfo = mock(ResourceInfo.class);
    when(resourceInfo.getResourceMethod()).thenReturn(method);
    when(resourceInfo.getResourceClass()).thenAnswer(invocation -> UserResource.class);

    ImpersonationRestrictionFilter filter = new ImpersonationRestrictionFilter();
    Field field = ImpersonationRestrictionFilter.class.getDeclaredField("resourceInfo");
    field.setAccessible(true);
    field.set(filter, resourceInfo);
    return filter;
  }

  private static CatalogSecurityContext securityContext(String user, String impersonatedBy) {
    return new CatalogSecurityContext(
        new CatalogPrincipal(user, user + "@example.com"),
        "https",
        CatalogSecurityContext.OPENID_AUTH,
        Set.of(),
        false,
        impersonatedBy);
  }

  private static ContainerRequestContext request(CatalogSecurityContext securityContext) {
    ContainerRequestContext requestContext = mock(ContainerRequestContext.class);
    when(requestContext.getSecurityContext()).thenReturn(securityContext);
    return requestContext;
  }
}
