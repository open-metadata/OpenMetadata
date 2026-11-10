package org.openmetadata.service.audit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ActivityAuditDAOs.AuditLogDAO;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.resources.context.ContextMemoryDocumentAccess;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class MemoryAuditProjectionTest {
  private static final String FILE_NAME = "restricted-document";
  private final EntityReference source =
      new EntityReference()
          .withId(UUID.randomUUID())
          .withType(Entity.CONTEXT_FILE)
          .withName(FILE_NAME)
          .withFullyQualifiedName(FILE_NAME);

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void eventImagesChangesRawJsonAndSummaryUseTheSameReferenceRules(boolean textual) {
    final ChangeDescription changes =
        new ChangeDescription()
            .withFieldsUpdated(
                List.of(
                    new FieldChange()
                        .withName("sourceEntity")
                        .withNewValue(JsonUtils.pojoToJson(source))));
    final ContextMemory memory =
        new ContextMemory()
            .withName("memory")
            .withPrimaryEntity(source)
            .withSourceEntity(source)
            .withSourceFile(source)
            .withRelatedEntities(List.of(source))
            .withChangeDescription(changes);
    final ChangeEvent event =
        new ChangeEvent()
            .withEntityType(Entity.CONTEXT_MEMORY)
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityFullyQualifiedName("memory")
            .withEntity(textual ? JsonUtils.pojoToJson(memory) : memory)
            .withChangeDescription(changes)
            .withIncrementalChangeDescription(changes);
    final AuditLogEntry entry =
        AuditLogEntry.builder()
            .entityType(Entity.CONTEXT_MEMORY)
            .eventType(event.getEventType().value())
            .changeEvent(event)
            .rawEventJson(JsonUtils.pojoToJson(event))
            .summary(FILE_NAME)
            .build();
    final ResultList<AuditLogEntry> entries = new ResultList<>(List.of(entry), null, null, 1);
    withFileProjection(projection -> repository().projectMemoryEntries(entries, projection));

    final String response = JsonUtils.pojoToJson(entries);
    assertFalse(response.contains(FILE_NAME), response);
    assertTrue(response.contains(source.getId().toString()), response);
    assertEquals(JsonUtils.pojoToJson(entry.getChangeEvent()), entry.getRawEventJson());
    assertTrue(JsonUtils.pojoToJson(event).contains(FILE_NAME), "The stored event stays whole");
  }

  @Test
  void anUnreadableEventHasNoRawFallbackOrValueSummary() {
    final AuditLogEntry entry =
        AuditLogEntry.builder()
            .eventType(EventType.ENTITY_UPDATED.value())
            .rawEventJson(FILE_NAME)
            .summary(FILE_NAME)
            .build();
    repository()
        .projectMemoryEntries(new ResultList<>(List.of(entry), null, null, 1), memory -> memory);
    assertNull(entry.getChangeEvent());
    assertNull(entry.getRawEventJson());
    assertEquals(EventType.ENTITY_UPDATED.value(), entry.getSummary());
  }

  @Test
  void anUnreadableEntityImageIsWithheld() {
    final ChangeEvent event = new ChangeEvent().withEntity("not JSON");
    assertNull(MemoryAuditProjection.apply(event, memory -> memory).getEntity());
    assertEquals("not JSON", event.getEntity());
  }

  @Test
  void anOrgWideFileStillNeedsItsPolicyPermission() {
    withFileProjection(
        MemoryVisibility.ENTITY,
        false,
        projection -> {
          final ContextMemory projected =
              projection.apply(new ContextMemory().withSourceEntity(source));
          assertNull(projected.getSourceEntity().getName());
          assertEquals(source.getId(), projected.getSourceEntity().getId());
        });
  }

  @Test
  void aReadableFileKeepsItsName() {
    withFileProjection(
        MemoryVisibility.ENTITY,
        true,
        projection ->
            assertEquals(
                source,
                projection.apply(new ContextMemory().withSourceEntity(source)).getSourceEntity()));
  }

  private AuditLogRepository repository() {
    final CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.auditLogDAO()).thenReturn(mock(AuditLogDAO.class));
    return new AuditLogRepository(dao);
  }

  private void withFileProjection(Consumer<UnaryOperator<ContextMemory>> action) {
    withFileProjection(MemoryVisibility.PRIVATE, true, action);
  }

  private void withFileProjection(
      MemoryVisibility visibility,
      boolean policyAllows,
      Consumer<UnaryOperator<ContextMemory>> action) {
    final SecurityContext context = mock(SecurityContext.class);
    when(context.getUserPrincipal()).thenReturn(() -> "reader");
    final ContextFileRepository files = mock(ContextFileRepository.class);
    when(files.getFields(anyString())).thenReturn(new Fields(Set.of(Entity.FIELD_OWNERS)));
    doReturn(new ContextFile().withShareConfig(new MemoryShareConfig().withVisibility(visibility)))
        .when(files)
        .get(any(), any(UUID.class), any(), any(RelationIncludes.class), anyBoolean());
    try (MockedStatic<Entity> registry = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> subjects = mockStatic(DefaultAuthorizer.class)) {
      subjects
          .when(() -> DefaultAuthorizer.getSubjectContext(context))
          .thenReturn(new SubjectContext(new User().withName("reader").withIsAdmin(false), null));
      registry.when(() -> Entity.hasEntityRepository(Entity.CONTEXT_FILE)).thenReturn(true);
      registry.when(() -> Entity.getEntityRepository(Entity.CONTEXT_FILE)).thenReturn(files);
      if (!policyAllows) {
        subjects
            .when(
                () ->
                    DefaultAuthorizer.authorizeUser(
                        anyString(), any(OperationContext.class), any(ResourceContext.class)))
            .thenThrow(new AuthorizationException("File is not readable"));
      }
      action.accept(ContextMemoryDocumentAccess.versionRedaction(context));
    }
  }
}
