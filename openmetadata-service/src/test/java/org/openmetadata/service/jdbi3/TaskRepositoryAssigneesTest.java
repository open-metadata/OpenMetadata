package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class TaskRepositoryAssigneesTest {
  private final TaskRepository repository = mock(TaskRepository.class, CALLS_REAL_METHODS);
  private final EntityReference owner =
      new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName("owner");
  private final EntityReference about =
      new EntityReference().withId(UUID.randomUUID()).withType(Entity.DOMAIN);

  @Test
  void defaultsUnassignedTasksToOwners() {
    final Task task = new Task().withAbout(about).withAssignees(List.of());

    resolveAssignees(task, List.of(owner));

    assertEquals(List.of(owner), task.getAssignees());
  }

  @Test
  void neverFallsBackToTheTaskCreator() {
    final Task task = new Task().withAbout(about).withAssignees(List.of()).withCreatedBy(owner);

    resolveAssignees(task, List.of(owner));

    assertTrue(task.getAssignees().isEmpty());
  }

  @Test
  void fallsBackToTheOtherOwnersWhenTheCreatorIsOneOfThem() {
    final EntityReference otherOwner =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName("other");
    final Task task = new Task().withAbout(about).withAssignees(List.of()).withCreatedBy(owner);

    resolveAssignees(task, List.of(owner, otherOwner));

    assertEquals(List.of(otherOwner), task.getAssignees());
  }

  @Test
  void preservesExplicitAssignees() {
    final EntityReference assignee =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName("reviewer");
    final Task task = new Task().withAbout(about).withAssignees(List.of(assignee));

    resolveAssignees(task, List.of(owner));

    assertEquals(List.of(assignee), task.getAssignees());
  }

  private void resolveAssignees(final Task task, final List<EntityReference> owners) {
    try (final var entities = mockStatic(Entity.class)) {
      entities.when(() -> Entity.getOwners(about)).thenReturn(owners);
      repository.setDefaultAssigneesFromEntityOwners(task);
    }
  }
}
