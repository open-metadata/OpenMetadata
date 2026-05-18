/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the
 *  License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 *  either express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.CONTAINER;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/**
 * Unit tests for {@link ContainerRepository#validateContainerParent} — the pure validation path
 * for PATCH-driven container re-parenting (issue #24294).
 *
 * <p>{@link Entity#getEntity} is mocked via {@link MockedStatic} so the test can drive
 * validation without bootstrapping the full repository / DB stack.
 */
class ContainerRepositoryParentValidationTest {

  private static final UUID SERVICE_A = UUID.randomUUID();
  private static final UUID SERVICE_B = UUID.randomUUID();
  private static final String SERVICE_A_FQN = "s3-prod";
  private static final String SERVICE_B_FQN = "gcs-prod";

  private static Container container(UUID id, String fqn, UUID serviceId, String serviceFqn) {
    return new Container()
        .withId(id)
        .withFullyQualifiedName(fqn)
        .withService(
            new EntityReference()
                .withId(serviceId)
                .withType(Entity.STORAGE_SERVICE)
                .withFullyQualifiedName(serviceFqn));
  }

  private static EntityReference parentRef(UUID id) {
    return new EntityReference().withId(id).withType(CONTAINER);
  }

  @Test
  void validateParent_allowsNullParent_movingToTopLevel() {
    Container original =
        container(UUID.randomUUID(), SERVICE_A_FQN + ".bucket", SERVICE_A, SERVICE_A_FQN);
    Container updated =
        container(original.getId(), original.getFullyQualifiedName(), SERVICE_A, SERVICE_A_FQN);
    updated.setParent(null);

    assertDoesNotThrow(() -> ContainerRepository.validateContainerParent(original, updated));
  }

  @Test
  void validateParent_allowsSiblingMoveInSameService() {
    UUID originalId = UUID.randomUUID();
    UUID newParentId = UUID.randomUUID();
    Container original =
        container(originalId, SERVICE_A_FQN + ".bucketA.child", SERVICE_A, SERVICE_A_FQN);
    Container updated =
        container(originalId, original.getFullyQualifiedName(), SERVICE_A, SERVICE_A_FQN);
    updated.setParent(parentRef(newParentId));

    Container newParent =
        container(newParentId, SERVICE_A_FQN + ".bucketB", SERVICE_A, SERVICE_A_FQN);

    try (MockedStatic<Entity> mocked = mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(eq(CONTAINER), eq(newParentId), eq("service"), eq(NON_DELETED)))
          .thenReturn(newParent);

      assertDoesNotThrow(() -> ContainerRepository.validateContainerParent(original, updated));
    }
  }

  @Test
  void validateParent_rejectsSelfParent() {
    UUID originalId = UUID.randomUUID();
    Container original =
        container(originalId, SERVICE_A_FQN + ".bucketA", SERVICE_A, SERVICE_A_FQN);
    Container updated =
        container(originalId, original.getFullyQualifiedName(), SERVICE_A, SERVICE_A_FQN);
    updated.setParent(parentRef(originalId));

    try (MockedStatic<Entity> mocked = mockStatic(Entity.class)) {
      mocked
          .when(
              () -> Entity.getEntity(eq(CONTAINER), eq(originalId), eq("service"), eq(NON_DELETED)))
          .thenReturn(original);

      IllegalArgumentException ex =
          assertThrows(
              IllegalArgumentException.class,
              () -> ContainerRepository.validateContainerParent(original, updated));
      assertTrue(ex.getMessage().contains(SERVICE_A_FQN + ".bucketA"));
      assertTrue(ex.getMessage().contains("itself or to its descendant"));
    }
  }

  @Test
  void validateParent_rejectsDescendantAsParent() {
    UUID originalId = UUID.randomUUID();
    UUID descendantId = UUID.randomUUID();
    Container original =
        container(originalId, SERVICE_A_FQN + ".bucketA", SERVICE_A, SERVICE_A_FQN);
    Container updated =
        container(originalId, original.getFullyQualifiedName(), SERVICE_A, SERVICE_A_FQN);
    updated.setParent(parentRef(descendantId));

    // Descendant FQN starts with original FQN + "." — would create a cycle.
    Container descendant =
        container(
            descendantId, SERVICE_A_FQN + ".bucketA.subfolder.deep", SERVICE_A, SERVICE_A_FQN);

    try (MockedStatic<Entity> mocked = mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(eq(CONTAINER), eq(descendantId), eq("service"), eq(NON_DELETED)))
          .thenReturn(descendant);

      IllegalArgumentException ex =
          assertThrows(
              IllegalArgumentException.class,
              () -> ContainerRepository.validateContainerParent(original, updated));
      assertTrue(ex.getMessage().contains("descendant"));
    }
  }

  @Test
  void validateParent_rejectsCrossServiceParent() {
    UUID originalId = UUID.randomUUID();
    UUID newParentId = UUID.randomUUID();
    Container original =
        container(originalId, SERVICE_A_FQN + ".bucketA", SERVICE_A, SERVICE_A_FQN);
    Container updated =
        container(originalId, original.getFullyQualifiedName(), SERVICE_A, SERVICE_A_FQN);
    updated.setParent(parentRef(newParentId));

    Container parentInDifferentService =
        container(newParentId, SERVICE_B_FQN + ".bucketX", SERVICE_B, SERVICE_B_FQN);

    try (MockedStatic<Entity> mocked = mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(eq(CONTAINER), eq(newParentId), eq("service"), eq(NON_DELETED)))
          .thenReturn(parentInDifferentService);

      IllegalArgumentException ex =
          assertThrows(
              IllegalArgumentException.class,
              () -> ContainerRepository.validateContainerParent(original, updated));
      assertTrue(ex.getMessage().contains(SERVICE_A_FQN));
      assertTrue(ex.getMessage().contains(SERVICE_B_FQN));
      assertTrue(ex.getMessage().contains("different StorageService"));
    }
  }

  @Test
  void validateSubtreeSize_allowsUnderLimit() {
    assertDoesNotThrow(
        () -> ContainerRepository.validateSubtreeSize(SERVICE_A_FQN + ".bucket", 0, 100));
    assertDoesNotThrow(
        () -> ContainerRepository.validateSubtreeSize(SERVICE_A_FQN + ".bucket", 50, 100));
  }

  @Test
  void validateSubtreeSize_allowsAtLimit() {
    // 10 descendants when the limit is exactly 10 is still allowed — the check is strict >.
    assertDoesNotThrow(
        () -> ContainerRepository.validateSubtreeSize(SERVICE_A_FQN + ".bucket", 10, 10));
  }

  @Test
  void validateSubtreeSize_rejectsOverLimit() {
    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                ContainerRepository.validateSubtreeSize(
                    SERVICE_A_FQN + ".bucket", 1_500_000, 10_000));
    assertTrue(ex.getMessage().contains(SERVICE_A_FQN + ".bucket"));
    assertTrue(ex.getMessage().contains("1500000"));
    assertTrue(ex.getMessage().contains("10000"));
    assertTrue(ex.getMessage().contains("openmetadata.container.maxReparentDescendants"));
  }

  @Test
  void maxReparentDescendants_defaultsTo10000WhenNoOverride() {
    ContainerRepository.clearMaxReparentDescendantsForTest();
    String previousProperty = System.clearProperty("openmetadata.container.maxReparentDescendants");
    try {
      assertEquals(10_000, ContainerRepository.maxReparentDescendants());
      assertEquals(
          ContainerRepository.DEFAULT_MAX_REPARENT_DESCENDANTS,
          ContainerRepository.maxReparentDescendants());
    } finally {
      if (previousProperty != null) {
        System.setProperty("openmetadata.container.maxReparentDescendants", previousProperty);
      }
    }
  }

  @Test
  void maxReparentDescendants_testOverrideTakesPriorityOverSystemProperty() {
    String previousProperty =
        System.setProperty("openmetadata.container.maxReparentDescendants", "7");
    try {
      // Without override, system property wins.
      ContainerRepository.clearMaxReparentDescendantsForTest();
      assertEquals(7, ContainerRepository.maxReparentDescendants());

      // With override, override wins.
      ContainerRepository.setMaxReparentDescendantsForTest(42);
      assertEquals(42, ContainerRepository.maxReparentDescendants());
    } finally {
      ContainerRepository.clearMaxReparentDescendantsForTest();
      if (previousProperty == null) {
        System.clearProperty("openmetadata.container.maxReparentDescendants");
      } else {
        System.setProperty("openmetadata.container.maxReparentDescendants", previousProperty);
      }
    }
  }

  @Test
  void validateParent_shortCircuitsWhenParentUnchanged() {
    // When the proposed parent has the same ID as the current parent, validateContainerParent
    // must NOT fire Entity.getEntity (avoids a DB round-trip on every container PATCH/PUT
    // that doesn't touch the parent).
    UUID originalId = UUID.randomUUID();
    UUID parentId = UUID.randomUUID();
    Container original =
        container(originalId, SERVICE_A_FQN + ".parent.child", SERVICE_A, SERVICE_A_FQN);
    original.setParent(parentRef(parentId));
    Container updated =
        container(originalId, original.getFullyQualifiedName(), SERVICE_A, SERVICE_A_FQN);
    updated.setParent(parentRef(parentId));

    try (MockedStatic<Entity> mocked = mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(eq(CONTAINER), any(UUID.class), eq("service"), eq(NON_DELETED)))
          .thenThrow(
              new AssertionError("Entity.getEntity must not be called when parent is unchanged"));
      assertDoesNotThrow(() -> ContainerRepository.validateContainerParent(original, updated));
    }
  }

  @Test
  void validateParent_propagatesEntityLookupFailure() {
    UUID originalId = UUID.randomUUID();
    UUID missingParentId = UUID.randomUUID();
    Container original =
        container(originalId, SERVICE_A_FQN + ".bucketA", SERVICE_A, SERVICE_A_FQN);
    Container updated =
        container(originalId, original.getFullyQualifiedName(), SERVICE_A, SERVICE_A_FQN);
    updated.setParent(parentRef(missingParentId));

    try (MockedStatic<Entity> mocked = mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(eq(CONTAINER), any(UUID.class), eq("service"), eq(NON_DELETED)))
          .thenThrow(new RuntimeException("not found"));

      assertThrows(
          RuntimeException.class,
          () -> ContainerRepository.validateContainerParent(original, updated));
    }
  }
}
