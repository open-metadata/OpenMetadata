package org.openmetadata.service.resources.audit;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.audit.AuditLogRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class AuditLogResourceTest {
  private static final String READER = "reader";
  private static final String ENTITY_NAME = "document";

  @Test
  void aPrivateMemoryUsesTheSameReadRuleAsTheMemoryEndpoint() {
    assertPrivateEntityIsDenied(
        Entity.CONTEXT_MEMORY,
        new ContextMemory()
            .withName(ENTITY_NAME)
            .withOwners(List.of(new EntityReference().withType(Entity.USER).withName("owner")))
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE)));
  }

  @Test
  void aPrivateFileUsesTheSameReadRuleAsTheFileEndpoint() {
    assertPrivateEntityIsDenied(
        Entity.CONTEXT_FILE,
        new ContextFile()
            .withName(ENTITY_NAME)
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE)));
  }

  @ParameterizedTest
  @ValueSource(strings = {Entity.CONTEXT_MEMORY, Entity.CONTEXT_FILE, Entity.ANNOUNCEMENT, ""})
  void collectionReadsRequireAnAdminOrBotForTypesWithTheirOwnReadRules(String type) {
    final Authorizer authorizer = collectionReader();
    assertThrows(
        AuthorizationException.class,
        () -> AuditLogEntityAccess.authorizeCollection(authorizer, null, type));
  }

  @Test
  void ordinaryEntityTypesKeepTheirCollectionPolicy() {
    assertDoesNotThrow(
        () -> AuditLogEntityAccess.authorizeCollection(collectionReader(), null, Entity.TABLE));
  }

  @Test
  void exportAndDownloadKeepTheSameAdminOrBotRule() {
    final AuditLogResource resource =
        new AuditLogResource(collectionReader(), mock(AuditLogRepository.class));
    assertThrows(
        AuthorizationException.class,
        () -> resource.exportAuditLogs(null, 1L, 2L, 10, null, null, null, null, null, null));
    assertThrows(AuthorizationException.class, () -> resource.getAuditExportJob(null, "1"));
    assertThrows(AuthorizationException.class, () -> resource.downloadAuditExportResult(null, "1"));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void adminsAndBotsReadAllEntries(boolean bot) {
    final SecurityContext context = mock(SecurityContext.class);
    final SubjectContext subject =
        new SubjectContext(new User().withName(READER).withIsAdmin(!bot).withIsBot(bot), null);
    try (MockedStatic<DefaultAuthorizer> subjects = mockStatic(DefaultAuthorizer.class)) {
      subjects.when(() -> DefaultAuthorizer.getSubjectContext(context)).thenReturn(subject);
      assertEquals(true, AuditLogEntityAccess.readsAll(context));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {Entity.CONTEXT_MEMORY, Entity.CONTEXT_FILE})
  void anOwnerMayReadAPrivateEntity(String type) {
    final List<EntityReference> owners =
        List.of(new EntityReference().withType(Entity.USER).withName(READER));
    final MemoryShareConfig sharing =
        new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE);
    final EntityInterface<?> entity =
        Entity.CONTEXT_MEMORY.equals(type)
            ? new ContextMemory().withOwners(owners).withShareConfig(sharing)
            : new ContextFile().withOwners(owners).withShareConfig(sharing);
    final SecurityContext context = mock(SecurityContext.class);
    when(context.getUserPrincipal()).thenReturn(() -> READER);
    try (MockedStatic<DefaultAuthorizer> subjects = mockStatic(DefaultAuthorizer.class)) {
      subjects
          .when(() -> DefaultAuthorizer.getSubjectContext(context))
          .thenReturn(new SubjectContext(new User().withName(READER).withIsAdmin(false), null));
      assertDoesNotThrow(() -> AuditLogEntityAccess.enforceVisibility(entity, null, context));
    }
  }

  private Authorizer collectionReader() {
    final Authorizer authorizer = mock(Authorizer.class);
    doThrow(new AuthorizationException("An admin or bot is required"))
        .when(authorizer)
        .authorizeAdminOrBot(any());
    return authorizer;
  }

  @SuppressWarnings("unchecked")
  private void assertPrivateEntityIsDenied(String type, EntityInterface<?> entity) {
    final SecurityContext context = mock(SecurityContext.class);
    when(context.getUserPrincipal()).thenReturn(() -> READER);
    final EntityRepository<EntityInterface<?>> entities = mock(EntityRepository.class);
    when(entities.getFields(anyString())).thenReturn(new Fields(Set.of("owners", "primaryEntity")));
    doReturn(entity)
        .when(entities)
        .getByName(any(), anyString(), any(), any(RelationIncludes.class), anyBoolean());
    final AuditLogResource resource =
        new AuditLogResource(mock(Authorizer.class), mock(AuditLogRepository.class));
    try (MockedStatic<Entity> registry = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> subjects = mockStatic(DefaultAuthorizer.class)) {
      registry.when(() -> Entity.getEntityRepository(type)).thenReturn(entities);
      registry
          .when(() -> Entity.getEntityByName(anyString(), anyString(), anyString(), any()))
          .thenReturn(entity);
      subjects
          .when(() -> DefaultAuthorizer.getSubjectContext(context))
          .thenReturn(new SubjectContext(new User().withName(READER).withIsAdmin(false), null));

      assertThrows(
          ForbiddenException.class,
          () ->
              resource.listAuditLogs(
                  context,
                  25,
                  null,
                  null,
                  null,
                  null,
                  null,
                  type,
                  ENTITY_NAME,
                  null,
                  null,
                  null,
                  null));
    }
  }
}
