package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.TestCaseResourceContext;

class ViewPermissionFilterTest {
  private final Authorizer authorizer = mock(Authorizer.class);
  private final SecurityContext caller = mock(SecurityContext.class);
  private final ViewPermissionFilter filter = new ViewPermissionFilter(authorizer);
  private final List<AuthRequest> requests =
      List.of(
          new AuthRequest(
              new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS),
              TestCaseResourceContext.builder().build()));

  @Test
  void aRowIsDecidedAsItsEndpointDecidesAnyOfItsGrants() {
    assertTrue(filter.isPermittedAny(caller, () -> requests));
    verify(authorizer).authorizeRequests(caller, requests, AuthorizationLogic.ANY);
  }

  @Test
  void aRowItsEndpointRefusesIsLeftOut() {
    doThrow(new PolicyDeniedException("denied"))
        .when(authorizer)
        .authorizeRequests(caller, requests, AuthorizationLogic.ANY);
    assertFalse(filter.isPermittedAny(caller, () -> requests));
  }

  @Test
  void aRowWhoseGrantsCannotBeResolvedIsLeftOut() {
    assertFalse(
        filter.isPermittedAny(
            caller,
            () -> {
              throw new EntityNotFoundException("test case is gone");
            }));
    verifyNoInteractions(authorizer);
  }
}
