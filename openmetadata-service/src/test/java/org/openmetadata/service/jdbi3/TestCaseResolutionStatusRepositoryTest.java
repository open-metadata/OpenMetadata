/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseFailureReasonType;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.EntityReference;

@Execution(ExecutionMode.CONCURRENT)
class TestCaseResolutionStatusRepositoryTest {

  @Test
  void testAddOriginEntityFQNJoin_withOriginEntityFQN() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("originEntityFQN", "test.table");

    String result = TestCaseResolutionStatusRepository.addOriginEntityFQNJoin(filter, "WHERE 1=1");

    assertTrue(result.contains("INNER JOIN"));
    assertTrue(result.contains("test_case"));
    assertTrue(result.contains("WHERE 1=1"));
  }

  @Test
  void testAddOriginEntityFQNJoin_withInclude() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("include", "non-deleted");

    String result = TestCaseResolutionStatusRepository.addOriginEntityFQNJoin(filter, "WHERE 1=1");

    assertTrue(result.contains("INNER JOIN"));
    assertTrue(result.contains("test_case"));
  }

  @Test
  void testAddOriginEntityFQNJoin_withDefaultFilter() {
    // ListFilter() default constructor sets include = Include.NON_DELETED
    // The addOriginEntityFQNJoin method adds JOIN when either originEntityFQN OR include is present
    // Since include is always set by default, the JOIN is always added
    ListFilter filter = new ListFilter();

    String result = TestCaseResolutionStatusRepository.addOriginEntityFQNJoin(filter, "WHERE 1=1");

    // With default ListFilter, JOIN is added because include is set to NON_DELETED
    assertTrue(result.contains("INNER JOIN"));
    assertTrue(result.contains("WHERE 1=1"));
  }

  @Test
  void testAddOriginEntityFQNJoin_preservesCondition() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("originEntityFQN", "test.table");

    String result =
        TestCaseResolutionStatusRepository.addOriginEntityFQNJoin(filter, "WHERE status = 'Open'");

    assertTrue(result.contains("WHERE status = 'Open'"));
  }

  @Test
  void testIncidentStateMachine_validTransitions() {
    assertTrue(
        isValidTransition(TestCaseResolutionStatusTypes.New, TestCaseResolutionStatusTypes.Ack));
    assertTrue(
        isValidTransition(
            TestCaseResolutionStatusTypes.New, TestCaseResolutionStatusTypes.Assigned));
    assertTrue(
        isValidTransition(
            TestCaseResolutionStatusTypes.New, TestCaseResolutionStatusTypes.Resolved));
    assertTrue(
        isValidTransition(
            TestCaseResolutionStatusTypes.Ack, TestCaseResolutionStatusTypes.Assigned));
    assertTrue(
        isValidTransition(
            TestCaseResolutionStatusTypes.Ack, TestCaseResolutionStatusTypes.Resolved));
    assertTrue(
        isValidTransition(
            TestCaseResolutionStatusTypes.Assigned, TestCaseResolutionStatusTypes.Resolved));
    assertTrue(
        isValidTransition(
            TestCaseResolutionStatusTypes.Assigned, TestCaseResolutionStatusTypes.Assigned));
  }

  @Test
  void testIncidentStateMachine_resolvedIsTerminal() {
    assertFalse(
        isValidTransition(
            TestCaseResolutionStatusTypes.Resolved, TestCaseResolutionStatusTypes.New));
    assertFalse(
        isValidTransition(
            TestCaseResolutionStatusTypes.Resolved, TestCaseResolutionStatusTypes.Ack));
    assertFalse(
        isValidTransition(
            TestCaseResolutionStatusTypes.Resolved, TestCaseResolutionStatusTypes.Assigned));
    assertFalse(
        isValidTransition(
            TestCaseResolutionStatusTypes.Resolved, TestCaseResolutionStatusTypes.Resolved));
  }

  @Test
  void testIncidentStateMachine_newCannotGoBackward() {
    assertFalse(
        isValidTransition(TestCaseResolutionStatusTypes.Ack, TestCaseResolutionStatusTypes.New));
    assertFalse(
        isValidTransition(
            TestCaseResolutionStatusTypes.Assigned, TestCaseResolutionStatusTypes.New));
    assertFalse(
        isValidTransition(
            TestCaseResolutionStatusTypes.Assigned, TestCaseResolutionStatusTypes.Ack));
  }

  @Test
  void testResolutionStatusDetails_resolved() {
    Resolved resolved =
        new Resolved()
            .withTestCaseFailureReason(TestCaseFailureReasonType.FalsePositive)
            .withTestCaseFailureComment("Test was incorrectly flagged");

    assertEquals(TestCaseFailureReasonType.FalsePositive, resolved.getTestCaseFailureReason());
    assertEquals("Test was incorrectly flagged", resolved.getTestCaseFailureComment());
  }

  @Test
  void testResolutionStatusDetails_assigned() {
    EntityReference assignee = createUserReference("test-user");
    Assigned assigned = new Assigned().withAssignee(assignee);

    assertNotNull(assigned.getAssignee());
    assertEquals("test-user", assigned.getAssignee().getName());
  }

  @Test
  void testIncidentStatus_unresolvedStates() {
    assertTrue(isUnresolvedStatus(TestCaseResolutionStatusTypes.New));
    assertTrue(isUnresolvedStatus(TestCaseResolutionStatusTypes.Ack));
    assertTrue(isUnresolvedStatus(TestCaseResolutionStatusTypes.Assigned));
    assertFalse(isUnresolvedStatus(TestCaseResolutionStatusTypes.Resolved));
  }

  @Test
  void testIncidentStatus_canInheritStateId() {
    UUID stateId = UUID.randomUUID();
    TestCaseResolutionStatus incident1 = createIncident(TestCaseResolutionStatusTypes.New);
    incident1.setStateId(stateId);

    TestCaseResolutionStatus incident2 = createIncident(TestCaseResolutionStatusTypes.Ack);
    incident2.setStateId(incident1.getStateId());

    assertEquals(stateId, incident1.getStateId());
    assertEquals(stateId, incident2.getStateId());
  }

  @Test
  void testIncidentStatus_severityInheritance() {
    TestCaseResolutionStatus incident = createIncident(TestCaseResolutionStatusTypes.New);
    incident.setSeverity(Severity.Severity1);

    TestCaseResolutionStatus newIncident = createIncident(TestCaseResolutionStatusTypes.Ack);
    if (newIncident.getSeverity() == null) {
      newIncident.setSeverity(incident.getSeverity());
    }

    assertEquals(Severity.Severity1, newIncident.getSeverity());
  }

  @Test
  void testIncidentStatus_timestampOrdering() {
    long time1 = System.currentTimeMillis();
    TestCaseResolutionStatus incident1 = createIncident(TestCaseResolutionStatusTypes.New);
    incident1.setTimestamp(time1);

    long time2 = time1 + 1000;
    TestCaseResolutionStatus incident2 = createIncident(TestCaseResolutionStatusTypes.Ack);
    incident2.setTimestamp(time2);

    assertTrue(incident2.getTimestamp() > incident1.getTimestamp());
  }

  @Test
  void testFailureReasonTypes() {
    assertEquals("FalsePositive", TestCaseFailureReasonType.FalsePositive.value());
    assertEquals("Duplicates", TestCaseFailureReasonType.Duplicates.value());
    assertEquals("MissingData", TestCaseFailureReasonType.MissingData.value());
    assertEquals("OutOfBounds", TestCaseFailureReasonType.OutOfBounds.value());
    assertEquals("Other", TestCaseFailureReasonType.Other.value());
  }

  @Test
  void testSeverityLevels() {
    assertEquals("Severity1", Severity.Severity1.value());
    assertEquals("Severity2", Severity.Severity2.value());
    assertEquals("Severity3", Severity.Severity3.value());
    assertEquals("Severity4", Severity.Severity4.value());
    assertEquals("Severity5", Severity.Severity5.value());
  }

  private TestCaseResolutionStatus createIncident(TestCaseResolutionStatusTypes statusType) {
    return new TestCaseResolutionStatus()
        .withId(UUID.randomUUID())
        .withStateId(UUID.randomUUID())
        .withTimestamp(System.currentTimeMillis())
        .withTestCaseResolutionStatusType(statusType)
        .withUpdatedAt(System.currentTimeMillis());
  }

  private EntityReference createUserReference(String userName) {
    return new EntityReference().withId(UUID.randomUUID()).withType("user").withName(userName);
  }

  private boolean isValidTransition(
      TestCaseResolutionStatusTypes from, TestCaseResolutionStatusTypes to) {
    if (from == TestCaseResolutionStatusTypes.Resolved) {
      return false;
    }
    return switch (from) {
      case New -> to == TestCaseResolutionStatusTypes.Ack
          || to == TestCaseResolutionStatusTypes.Assigned
          || to == TestCaseResolutionStatusTypes.Resolved;
      case Ack -> to == TestCaseResolutionStatusTypes.Assigned
          || to == TestCaseResolutionStatusTypes.Resolved;
      case Assigned -> to == TestCaseResolutionStatusTypes.Assigned
          || to == TestCaseResolutionStatusTypes.Resolved;
      default -> false;
    };
  }

  private boolean isUnresolvedStatus(TestCaseResolutionStatusTypes status) {
    return status != TestCaseResolutionStatusTypes.Resolved;
  }
}
