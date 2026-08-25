/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;

import java.util.List;
import java.util.UUID;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.TableRepository;

class TaskResourceContextTest {

  // Use a synthetic entity type so the test does not clobber the real TableRepository
  // registration in the shared static Entity.ENTITY_REPOSITORY_MAP. Other tests running in the
  // same JVM continue to see the real Table repository.
  private static final String TARGET_ENTITY_TYPE = "task-context-test-target";

  private static EntityReference targetOwnerRef;
  private static EntityReference targetRef;
  private static EntityReference taskAssigneeRef;
  private static EntityReference taskFilerRef;

  @BeforeAll
  static void setup() throws Exception {
    TableRepository targetRepository = mock(TableRepository.class);
    Mockito.when(targetRepository.getEntityType()).thenReturn(TARGET_ENTITY_TYPE);
    Entity.registerEntity(Table.class, TARGET_ENTITY_TYPE, targetRepository);

    targetOwnerRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.USER)
            .withName("targetOwner");

    Table target =
        new Table()
            .withId(UUID.randomUUID())
            .withName("target")
            .withFullyQualifiedName("svc.db.schema.target")
            .withOwners(List.of(targetOwnerRef));
    targetRef =
        new EntityReference()
            .withId(target.getId())
            .withType(TARGET_ENTITY_TYPE)
            .withName(target.getName())
            .withFullyQualifiedName(target.getFullyQualifiedName());

    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(TARGET_ENTITY_TYPE, target.getId()), JsonUtils.pojoToJson(target));

    // Repository.getOwners(reference) → returns the entity's owners
    Mockito.when(targetRepository.getOwners(any(EntityReference.class)))
        .thenReturn(target.getOwners());
    Mockito.when(targetRepository.find(any(UUID.class), any()))
        .thenAnswer(
            i ->
                JsonUtils.readValue(
                    EntityRepository.CACHE_WITH_ID.get(
                        new ImmutablePair<>(TARGET_ENTITY_TYPE, i.getArgument(0))),
                    Table.class));
    Mockito.when(targetRepository.findByName(anyString(), any()))
        .thenAnswer(
            i ->
                JsonUtils.readValue(
                    EntityRepository.CACHE_WITH_NAME.get(
                        new ImmutablePair<>(TARGET_ENTITY_TYPE, i.getArgument(0))),
                    Table.class));

    taskAssigneeRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.USER)
            .withName("assigneeUser");
    taskFilerRef =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName("filerUser");
  }

  @Test
  void getOwners_returnsTargetEntityOwners_notTaskAssignees() {
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withName("test-task")
            .withAbout(targetRef)
            .withCreatedBy(taskFilerRef)
            .withAssignees(List.of(taskAssigneeRef));

    TaskResourceContext context = new TaskResourceContext(task);
    List<EntityReference> owners = context.getOwners();

    assertNotNull(owners);
    assertEquals(1, owners.size(), "Owners must come from the target entity only");
    assertEquals(targetOwnerRef.getId(), owners.get(0).getId());
    assertTrue(
        owners.stream().noneMatch(o -> o.getId().equals(taskAssigneeRef.getId())),
        "Task assignees must not be exposed as owners");
    assertTrue(
        owners.stream().noneMatch(o -> o.getId().equals(taskFilerRef.getId())),
        "Task filer must not be exposed as owners");
  }

  @Test
  void getOwners_returnsEmpty_whenAboutMissing() {
    Task task = new Task().withId(UUID.randomUUID()).withName("orphan-task");
    TaskResourceContext context = new TaskResourceContext(task);
    assertTrue(context.getOwners().isEmpty());
  }

  @Test
  void getResource_returnsTaskEntityName() {
    Task task = new Task().withId(UUID.randomUUID());
    assertEquals(Entity.TASK, new TaskResourceContext(task).getResource());
  }

  @Test
  void getOwners_degradesGracefully_whenAboutEntityResolverThrows() {
    // Simulate a task whose target entity type is unregistered (or hard-deleted to the point
    // that the repository cannot resolve it). Entity.getOwners throws under those conditions;
    // TaskResourceContext.getOwners must catch and return an empty list rather than letting
    // a 500 surface from the policy evaluation path.
    EntityReference unresolvableRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("nonexistent-entity-type")
            .withName("ghost")
            .withFullyQualifiedName("ghost");
    Task task =
        new Task().withId(UUID.randomUUID()).withName("stale-ref-task").withAbout(unresolvableRef);

    TaskResourceContext context = new TaskResourceContext(task);
    assertTrue(context.getOwners().isEmpty());
  }
}
