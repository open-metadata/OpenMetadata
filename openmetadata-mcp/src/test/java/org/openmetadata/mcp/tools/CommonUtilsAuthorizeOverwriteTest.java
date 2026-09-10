package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TagRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CommonUtilsAuthorizeOverwriteTest {

  private final Authorizer authorizer = mock(Authorizer.class);
  private final CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);

  @Test
  void anExistingEntityIsReauthorizedAsEditAll() {
    // Every create_* tool authorizes CREATE and then calls createOrUpdate, so a caller holding
    // Create but not Edit could overwrite an entity owned by someone else. REST derives EDIT_ALL
    // for the update leg (EntityUtil.createOrUpdateOperation) and authorizes it against the
    // existing entity; this restores that parity on the MCP surface.
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TAG))
          .thenReturn(mock(TagRepository.class));
      entityMock
          .when(() -> Entity.getEntityReferenceByName(eq(Entity.TAG), eq("PII.Sensitive"), any()))
          .thenReturn(new EntityReference().withName("Sensitive"));

      CommonUtils.authorizeOverwrite(authorizer, securityContext, Entity.TAG, tag("PII.Sensitive"));

      ArgumentCaptor<OperationContext> operations = ArgumentCaptor.forClass(OperationContext.class);
      ArgumentCaptor<ResourceContextInterface> resources =
          ArgumentCaptor.forClass(ResourceContextInterface.class);
      verify(authorizer).authorize(any(), operations.capture(), resources.capture());
      assertInstanceOf(ResourceContext.class, resources.getValue());
      assertEquals(
          java.util.List.of(MetadataOperation.EDIT_ALL),
          operations.getValue().getOperations(resources.getValue()));
    }
  }

  @Test
  void aNewEntityIsNotReauthorized() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityReferenceByName(eq(Entity.TAG), eq("PII.Sensitive"), any()))
          .thenThrow(new EntityNotFoundException("not found"));

      CommonUtils.authorizeOverwrite(authorizer, securityContext, Entity.TAG, tag("PII.Sensitive"));

      verify(authorizer, never()).authorize(any(), any(), any());
    }
  }

  @Test
  void anEntityWithoutAResolvedFqnIsNotReauthorized() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      CommonUtils.authorizeOverwrite(authorizer, securityContext, Entity.TAG, tag(null));

      verify(authorizer, never()).authorize(any(), any(), any());
      entityMock.verify(() -> Entity.getEntityReferenceByName(any(), any(), any()), never());
    }
  }

  @Test
  void aSoftDeletedEntityIsStillReauthorized() {
    // createOrUpdate finds the original with Include.ALL, so it will update a soft-deleted entity
    // in place. Checking with NON_DELETED would miss it and skip the EDIT_ALL check entirely.
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TAG))
          .thenReturn(mock(TagRepository.class));
      entityMock
          .when(
              () ->
                  Entity.getEntityReferenceByName(
                      eq(Entity.TAG), eq("PII.Sensitive"), eq(Include.NON_DELETED)))
          .thenThrow(new EntityNotFoundException("soft deleted"));
      entityMock
          .when(
              () ->
                  Entity.getEntityReferenceByName(
                      eq(Entity.TAG), eq("PII.Sensitive"), eq(Include.ALL)))
          .thenReturn(new EntityReference().withName("Sensitive"));

      CommonUtils.authorizeOverwrite(authorizer, securityContext, Entity.TAG, tag("PII.Sensitive"));

      verify(authorizer).authorize(any(), any(), any());
    }
  }

  private static Tag tag(String fqn) {
    return new Tag().withName("Sensitive").withFullyQualifiedName(fqn);
  }
}
