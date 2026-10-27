package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

class ServiceConnectionAccessTest {

  @ParameterizedTest
  @CsvSource({
    "EDIT_ALL, ALLOW, true",
    "EDIT_ALL, NOT_ALLOW, false",
    "EDIT_ALL, DENY, false",
    "EDIT_DESCRIPTION, ALLOW, false",
    "VIEW_ALL, ALLOW, false"
  })
  void onlyAnAllowedEditAllEntitlesTheCallerToTheConnection(
      MetadataOperation operation, Access access, boolean expected) {
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    ResourceContextInterface service = mock(ResourceContextInterface.class);
    when(authorizer.getPermission(securityContext, null, service))
        .thenReturn(
            new ResourcePermission()
                .withPermissions(
                    List.of(new Permission().withOperation(operation).withAccess(access))));

    assertEquals(
        expected, ServiceConnectionAccess.canEditConnection(authorizer, securityContext, service));
  }
}
