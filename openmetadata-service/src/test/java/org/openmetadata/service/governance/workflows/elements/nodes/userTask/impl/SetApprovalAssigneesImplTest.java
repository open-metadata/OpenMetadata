/*
 *  Copyright 2024 Collate.
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

package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.feeds.MessageParser;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SetApprovalAssigneesImplTest {

  @Mock private DelegateExecution execution;
  @Mock private Expression assigneesExpr;
  @Mock private Expression assigneesVarNameExpr;
  @Mock private Expression inputNamespaceMapExpr;
  @Mock private EntityInterface mockEntity;

  @SuppressWarnings("rawtypes")
  @Mock
  private EntityRepository mockRepository;

  private SetApprovalAssigneesImpl delegate;
  private MockedStatic<Entity> mockedEntity;
  private Map<String, Object> capturedVars;

  @BeforeEach
  void setUp() throws Exception {
    delegate = new SetApprovalAssigneesImpl();
    injectField(delegate, "assigneesExpr", assigneesExpr);
    injectField(delegate, "assigneesVarNameExpr", assigneesVarNameExpr);
    injectField(delegate, "inputNamespaceMapExpr", inputNamespaceMapExpr);

    when(inputNamespaceMapExpr.getValue(execution)).thenReturn("{\"relatedEntity\":\"global\"}");
    when(assigneesVarNameExpr.getValue(execution)).thenReturn("ApprovalTask_assignees");
    when(execution.getVariable("global_relatedEntity"))
        .thenReturn("<#E::classification::test_classification>");
    when(mockRepository.isSupportsReviewers()).thenReturn(true);
    when(mockEntity.getOwners()).thenReturn(List.of());

    mockedEntity = mockStatic(Entity.class);
    mockedEntity.when(() -> Entity.getEntityRepository(anyString())).thenReturn(mockRepository);
    mockedEntity
        .when(
            () ->
                Entity.getEntity(
                    any(MessageParser.EntityLink.class), anyString(), any(Include.class)))
        .thenReturn(mockEntity);

    capturedVars = new HashMap<>();
    doAnswer(
            inv -> {
              capturedVars.put(inv.getArgument(0), inv.getArgument(1));
              return null;
            })
        .when(execution)
        .setVariable(anyString(), any());
  }

  @AfterEach
  void tearDown() {
    mockedEntity.close();
  }

  /**
   * Regression test for FQN quoting mismatch: a user whose name contains a dot (e.g. "ram.balaji")
   * has their FQN stored as {@code "ram.balaji"} (with literal quotes) in the assignees list, but
   * {@code event.getUserName()} returns the raw unquoted value. Without {@code
   * FullyQualifiedName.quoteName()} the {@code remove()} call never matches and the user still
   * receives the task they triggered.
   */
  @Test
  void testSelfApprovalPrevention_dottedUsername_removedFromAssignees() {
    // Reviewer FQN is quoted because the name contains a dot
    EntityReference dottedUserRef =
        new EntityReference().withType("user").withFullyQualifiedName("\"ram.balaji\"");
    EntityReference otherUserRef =
        new EntityReference().withType("user").withFullyQualifiedName("john");

    when(mockEntity.getReviewers()).thenReturn(List.of(dottedUserRef, otherUserRef));
    // updatedBy arrives unquoted from event.getUserName()
    when(execution.getVariable("global_updatedBy")).thenReturn("ram.balaji");
    when(assigneesExpr.getValue(execution))
        .thenReturn("{\"addReviewers\":true,\"addOwners\":false,\"users\":[],\"teams\":[]}");

    delegate.execute(execution);

    String assigneesJson = (String) capturedVars.get("ApprovalTask_assignees");
    assertNotNull(assigneesJson);
    assertFalse(
        assigneesJson.contains("ram.balaji"),
        "Dotted username should have been removed by self-approval prevention");
    assertTrue(assigneesJson.contains("john"), "Other reviewer should remain as assignee");
  }

  @Test
  void testSelfApprovalPrevention_simpleUsername_removedFromAssignees() {
    EntityReference simpleUserRef =
        new EntityReference().withType("user").withFullyQualifiedName("alice");
    EntityReference dottedUserRef =
        new EntityReference().withType("user").withFullyQualifiedName("\"ram.balaji\"");

    when(mockEntity.getReviewers()).thenReturn(List.of(simpleUserRef, dottedUserRef));
    when(execution.getVariable("global_updatedBy")).thenReturn("alice");
    when(assigneesExpr.getValue(execution))
        .thenReturn("{\"addReviewers\":true,\"addOwners\":false,\"users\":[],\"teams\":[]}");

    delegate.execute(execution);

    String assigneesJson = (String) capturedVars.get("ApprovalTask_assignees");
    assertNotNull(assigneesJson);
    assertFalse(
        assigneesJson.contains("<#E::user::alice>"),
        "Updater (simple name) should be removed from assignees");
    assertTrue(assigneesJson.contains("ram.balaji"), "Other reviewer should remain as assignee");
  }

  @Test
  void testSelfApprovalPrevention_nullUpdatedBy_allReviewersRetained() {
    EntityReference reviewerRef =
        new EntityReference().withType("user").withFullyQualifiedName("\"ram.balaji\"");

    when(mockEntity.getReviewers()).thenReturn(List.of(reviewerRef));
    when(execution.getVariable("global_updatedBy")).thenReturn(null);
    when(assigneesExpr.getValue(execution))
        .thenReturn("{\"addReviewers\":true,\"addOwners\":false,\"users\":[],\"teams\":[]}");

    assertDoesNotThrow(() -> delegate.execute(execution));

    String assigneesJson = (String) capturedVars.get("ApprovalTask_assignees");
    assertNotNull(assigneesJson);
    assertTrue(
        assigneesJson.contains("ram.balaji"),
        "All reviewers should be retained when updatedBy is null");
  }

  private static void injectField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
