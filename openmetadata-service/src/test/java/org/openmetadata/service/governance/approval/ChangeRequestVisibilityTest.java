/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.approval;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GovernanceDAOs.ChangeRequestDAO;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Which readers of a change request's review task see the fields the task carries from the
 * request. The DAOs, repositories and subject lookups are mocked; the visibility rule itself runs.
 */
class ChangeRequestVisibilityTest {
  private static final String REQUESTER = "requester";
  private static final String ASSIGNEE = "assignee";
  private static final String ADMIN = "admin";
  private static final String READER = "reader";
  private static final String PROPOSED_DESCRIPTION = "proposed description";
  private static final String TASK_FORM_KEY = "reason";
  private static final String FIELD_DESCRIPTION = "description";

  private final UUID entityId = UUID.randomUUID();
  private final UUID requestId = UUID.randomUUID();
  private final UUID taskId = UUID.randomUUID();
  private final Authorizer authorizer = mock(Authorizer.class);
  private final TaskRepository taskRepository = mock(TaskRepository.class);
  private final ChangeRequestDAO changeRequestDAO = mock(ChangeRequestDAO.class);

  private MockedStatic<Entity> entity;
  private MockedStatic<SubjectContext> subjects;

  @BeforeEach
  void setUp() {
    entity = mockStatic(Entity.class);
    subjects = mockStatic(SubjectContext.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.changeRequestDAO()).thenReturn(changeRequestDAO);
    entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    entity.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(taskRepository);
    EntityRepository<?> glossaries = glossaryRepository();
    entity.when(() -> Entity.getEntityRepository(Entity.GLOSSARY)).thenReturn(glossaries);
    entity
        .when(() -> Entity.getEntities(anyList(), anyString(), eq(Include.ALL)))
        .thenAnswer(invocation -> List.of(reviewTask()));
    when(changeRequestDAO.findById(requestId))
        .thenReturn(
            new ChangeRequest()
                .withId(requestId)
                .withEntityType(Entity.GLOSSARY)
                .withEntityId(entityId)
                .withRequestedBy(REQUESTER)
                .withTaskId(taskId));
    SubjectContext reader = subject(false);
    SubjectContext admin = subject(true);
    subjects.when(() -> SubjectContext.getSubjectContext(anyString())).thenReturn(reader);
    subjects.when(() -> SubjectContext.getSubjectContext(ADMIN)).thenReturn(admin);
    doThrow(new AuthorizationException("not an assignee"))
        .when(taskRepository)
        .checkPermissionsForResolveTask(
            eq(authorizer), any(Task.class), eq(false), any(SecurityContext.class));
  }

  @AfterEach
  void tearDown() {
    subjects.close();
    entity.close();
  }

  @Test
  void requesterSeesTheRequestFields() {
    assertRequestFieldsKept(REQUESTER);
  }

  @Test
  void assigneeOfTheReviewTaskSeesTheRequestFields() {
    SecurityContext assignee = callerNamed(ASSIGNEE);
    doNothing()
        .when(taskRepository)
        .checkPermissionsForResolveTask(eq(authorizer), any(Task.class), eq(false), eq(assignee));

    assertKept(ChangeRequestVisibility.redactTask(authorizer, assignee, reviewTask()));
    List<Task> page = List.of(reviewTask());
    ChangeRequestVisibility.redactTasks(authorizer, assignee, page);
    assertKept(page.getFirst());
  }

  @Test
  void adminSeesTheRequestFields() {
    assertRequestFieldsKept(ADMIN);
  }

  @Test
  void otherReaderGetsTheTaskWithoutTheRequestFields() {
    SecurityContext reader = callerNamed(READER);

    Task single = ChangeRequestVisibility.redactTask(authorizer, reader, reviewTask());

    assertRedacted(single);
    List<Task> page = List.of(reviewTask());
    ChangeRequestVisibility.redactTasks(authorizer, reader, page);
    assertRedacted(page.getFirst());
  }

  @Test
  void otherReaderKeepsTheProposedChangesOfATaskThatReviewsNoRequest() {
    Task approval = reviewTask();
    Map<String, Object> payload = JsonUtils.getMap(approval.getPayload());
    payload.remove("changeRequestId");
    payload.remove("changeRequestRevision");
    approval.setPayload(payload);

    ChangeRequestVisibility.redactTasks(authorizer, callerNamed(READER), List.of(approval));

    assertTrue(JsonUtils.pojoToJson(approval.getPayload()).contains(PROPOSED_DESCRIPTION));
  }

  @Test
  void otherReaderGetsTheTaskWithoutTheRequestFieldsWhenTheRequestIsGone() {
    when(changeRequestDAO.findById(requestId)).thenReturn(null);

    assertRedacted(
        ChangeRequestVisibility.redactTask(authorizer, callerNamed(REQUESTER), reviewTask()));
  }

  private void assertRequestFieldsKept(String caller) {
    SecurityContext securityContext = callerNamed(caller);
    assertKept(ChangeRequestVisibility.redactTask(authorizer, securityContext, reviewTask()));
    List<Task> page = List.of(reviewTask());
    ChangeRequestVisibility.redactTasks(authorizer, securityContext, page);
    assertKept(page.getFirst());
  }

  private static void assertKept(Task task) {
    Map<String, Object> payload = JsonUtils.getMap(task.getPayload());
    assertTrue(payload.containsKey("changeRequestId"));
    assertTrue(payload.containsKey("changeRequestRevision"));
    assertTrue(JsonUtils.pojoToJson(task).contains(PROPOSED_DESCRIPTION));
  }

  private static void assertRedacted(Task task) {
    Map<String, Object> payload = JsonUtils.getMap(task.getPayload());
    assertEquals(Set.of(TASK_FORM_KEY), payload.keySet());
    assertFalse(JsonUtils.pojoToJson(task).contains(PROPOSED_DESCRIPTION));
    assertEquals(
        List.of(FIELD_DESCRIPTION),
        task.getChangeDescription().getFieldsUpdated().stream().map(FieldChange::getName).toList());
  }

  private Task reviewTask() {
    Map<String, Object> proposed = new LinkedHashMap<>();
    proposed.put(FIELD_DESCRIPTION, Map.of("added", List.of(PROPOSED_DESCRIPTION)));
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put(TASK_FORM_KEY, "review");
    payload.put("changeRequestId", requestId.toString());
    payload.put("changeRequestRevision", 1);
    payload.put("proposedChanges", proposed);
    ChangeDescription history =
        new ChangeDescription()
            .withFieldsUpdated(
                List.of(
                    new FieldChange()
                        .withName(TaskRepository.FIELD_PAYLOAD)
                        .withNewValue(JsonUtils.pojoToJson(payload)),
                    new FieldChange().withName(FIELD_DESCRIPTION).withNewValue("Review")));
    return new Task().withId(taskId).withPayload(payload).withChangeDescription(history);
  }

  private EntityRepository<?> glossaryRepository() {
    EntityRepository<?> repository = mock(EntityRepository.class);
    when(repository.getEntityType()).thenReturn(Entity.GLOSSARY);
    when(repository.getFields(anyString())).thenReturn(new Fields(Set.of()));
    when(repository.get(
            isNull(), eq(entityId), any(Fields.class), any(RelationIncludes.class), anyBoolean()))
        .thenAnswer(invocation -> new Glossary().withId(entityId));
    return repository;
  }

  private static SubjectContext subject(boolean admin) {
    SubjectContext subject = mock(SubjectContext.class);
    when(subject.isAdmin()).thenReturn(admin);
    return subject;
  }

  private static SecurityContext callerNamed(String name) {
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn(name);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    return securityContext;
  }
}
