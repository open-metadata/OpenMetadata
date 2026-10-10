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

package org.openmetadata.service.resources.context;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class ContextMemoryWriteAccessTest {

  private static final String ALICE = "alice";
  private static final EntityReference WRITER = user(ALICE);
  private static final EntityReference SOMEONE_ELSE = user("bob");
  private static final EntityReference VIEWABLE = entity(Entity.TABLE);
  private static final EntityReference HIDDEN = entity(Entity.TABLE);
  private static final ContextMemoryWriteAccess.ReferenceAccess ONLY_VIEWABLE =
      (writer, reference) -> ALICE.equals(writer) && VIEWABLE.equals(reference);

  @Test
  void aNewMemoryMayNameNoOwnerOrOnlyItsWriter() {
    assertDoesNotThrow(() -> ContextMemoryWriteAccess.requireOwnedByWriter(null, WRITER));
    assertDoesNotThrow(() -> ContextMemoryWriteAccess.requireOwnedByWriter(List.of(), WRITER));
    assertDoesNotThrow(
        () -> ContextMemoryWriteAccess.requireOwnedByWriter(List.of(WRITER), WRITER));
  }

  @Test
  void aNewMemoryMayNotBeOwnedBySomeoneElse() {
    AuthorizationException refused =
        assertThrows(
            AuthorizationException.class,
            () -> ContextMemoryWriteAccess.requireOwnedByWriter(List.of(SOMEONE_ELSE), WRITER));
    assertEquals(ContextMemoryWriteAccess.OWNED_BY_SOMEONE_ELSE, refused.getMessage());
    assertThrows(
        AuthorizationException.class,
        () -> ContextMemoryWriteAccess.requireOwnedByWriter(List.of(WRITER, SOMEONE_ELSE), WRITER));
  }

  @Test
  void anUpdateMayKeepTheOwnersOrLeaveThemOut() {
    assertDoesNotThrow(
        () -> ContextMemoryWriteAccess.requireOwnersUnchanged(List.of(WRITER), List.of(WRITER)));
    assertDoesNotThrow(
        () -> ContextMemoryWriteAccess.requireOwnersUnchanged(List.of(WRITER), null));
  }

  @Test
  void anUpdateMayNotAddReplaceOrDropOwners() {
    List<List<EntityReference>> changes =
        List.of(List.of(WRITER, SOMEONE_ELSE), List.of(SOMEONE_ELSE), List.of());
    for (List<EntityReference> change : changes) {
      AuthorizationException refused =
          assertThrows(
              AuthorizationException.class,
              () -> ContextMemoryWriteAccess.requireOwnersUnchanged(List.of(WRITER), change));
      assertEquals(ContextMemoryWriteAccess.OWNERS_CHANGED, refused.getMessage());
    }
  }

  @Test
  void aMemoryWhoseReferencesAreAllViewableIsAccepted() {
    ContextMemory memory =
        new ContextMemory()
            .withPrimaryEntity(VIEWABLE)
            .withRelatedEntities(List.of(VIEWABLE))
            .withSourceEntity(VIEWABLE);

    assertDoesNotThrow(
        () -> ContextMemoryWriteAccess.requireViewableReferences(memory, ALICE, ONLY_VIEWABLE));
    assertDoesNotThrow(
        () ->
            ContextMemoryWriteAccess.requireViewableReferences(
                new ContextMemory(), ALICE, ONLY_VIEWABLE));
  }

  static Stream<Arguments> referenceFields() {
    return Stream.of(
        Arguments.of(
            ContextMemoryRepository.FIELD_PRIMARY_ENTITY,
            (Function<EntityReference, ContextMemory>)
                ref -> new ContextMemory().withPrimaryEntity(ref)),
        Arguments.of(
            ContextMemoryRepository.FIELD_RELATED_ENTITIES,
            (Function<EntityReference, ContextMemory>)
                ref -> new ContextMemory().withRelatedEntities(List.of(VIEWABLE, ref))),
        Arguments.of(
            ContextMemoryRepository.FIELD_SOURCE_ENTITY,
            (Function<EntityReference, ContextMemory>)
                ref -> new ContextMemory().withSourceEntity(ref)),
        Arguments.of(
            ContextMemoryRepository.FIELD_SOURCE_FILE,
            (Function<EntityReference, ContextMemory>)
                ref -> new ContextMemory().withSourceFile(ref)),
        Arguments.of(
            ContextMemoryRepository.FIELD_ROOT_MEMORY,
            (Function<EntityReference, ContextMemory>)
                ref -> new ContextMemory().withRootMemory(ref)),
        Arguments.of(
            ContextMemoryRepository.FIELD_PARENT_MEMORY,
            (Function<EntityReference, ContextMemory>)
                ref -> new ContextMemory().withParentMemory(ref)));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("referenceFields")
  void aReferenceTheWriterCannotViewIsRefusedByName(
      String field, Function<EntityReference, ContextMemory> pointingAt) {
    BadRequestException refused =
        assertThrows(
            BadRequestException.class,
            () ->
                ContextMemoryWriteAccess.requireViewableReferences(
                    pointingAt.apply(HIDDEN), ALICE, ONLY_VIEWABLE));

    assertEquals(
        String.format(ContextMemoryWriteAccess.UNVIEWABLE_REFERENCE, field), refused.getMessage());
  }

  @Test
  void serverCodeMustNameTheAdminAccountToWriteForOthers() {
    assertFalse(ContextMemoryWriteAccess.isPrivilegedWriter(null));
    assertTrue(ContextMemoryWriteAccess.isPrivilegedWriter(Entity.ADMIN_USER_NAME));
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {" ", "\t"})
  void aMissingWriterIsRefused(String writer) {
    AuthorizationException refused =
        assertThrows(
            AuthorizationException.class, () -> ContextMemoryWriteAccess.requireWriter(writer));
    assertEquals(ContextMemoryWriteAccess.MISSING_WRITER, refused.getMessage());
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemorySourceType.class,
      names = {"FILE_EXTRACTION", "PAGE_EXTRACTION"})
  void extractionProvenanceMayBePreservedButNeverEstablished(ContextMemorySourceType sourceType) {
    assertDoesNotThrow(
        () -> ContextMemoryWriteAccess.requireSourceTypeAllowed(sourceType, sourceType));
    assertThrows(
        AuthorizationException.class,
        () -> ContextMemoryWriteAccess.requireSourceTypeAllowed(null, sourceType));
    AuthorizationException refused =
        assertThrows(
            AuthorizationException.class,
            () ->
                ContextMemoryWriteAccess.requireSourceTypeAllowed(
                    ContextMemorySourceType.MANUAL, sourceType));
    assertEquals(ContextMemoryWriteAccess.EXTRACTION_SOURCE, refused.getMessage());
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemorySourceType.class,
      mode = EnumSource.Mode.EXCLUDE,
      names = {"FILE_EXTRACTION", "PAGE_EXTRACTION"})
  void userAuthoredSourcesRemainWritable(ContextMemorySourceType sourceType) {
    assertDoesNotThrow(() -> ContextMemoryWriteAccess.requireSourceTypeAllowed(null, sourceType));
    assertDoesNotThrow(
        () ->
            ContextMemoryWriteAccess.requireSourceTypeAllowed(
                ContextMemorySourceType.FILE_EXTRACTION, sourceType));
  }

  @Test
  void adminsAndBotsWriteForOthersAndEveryoneElseDoesNot() {
    try (MockedStatic<SubjectContext> subjects = Mockito.mockStatic(SubjectContext.class)) {
      subjects
          .when(() -> SubjectContext.getSubjectContext("root"))
          .thenReturn(new SubjectContext(new User().withName("root").withIsAdmin(true), null));
      subjects
          .when(() -> SubjectContext.getSubjectContext("ai-bot"))
          .thenReturn(new SubjectContext(new User().withName("ai-bot").withIsBot(true), null));
      subjects
          .when(() -> SubjectContext.getSubjectContext(ALICE))
          .thenReturn(new SubjectContext(new User().withName(ALICE), null));
      subjects
          .when(() -> SubjectContext.getSubjectContext("ghost"))
          .thenThrow(EntityNotFoundException.byName("ghost"));

      assertTrue(ContextMemoryWriteAccess.isPrivilegedWriter("root"));
      assertTrue(ContextMemoryWriteAccess.isPrivilegedWriter("ai-bot"));
      assertFalse(ContextMemoryWriteAccess.isPrivilegedWriter(ALICE));
      assertFalse(ContextMemoryWriteAccess.isPrivilegedWriter("ghost"));
    }
  }

  private static EntityReference user(String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName(name);
  }

  private static EntityReference entity(String type) {
    return new EntityReference().withId(UUID.randomUUID()).withType(type);
  }
}
