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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseFailureReasonType;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.indexes.TestCaseResolutionStatusIndex;

@Execution(ExecutionMode.CONCURRENT)
class TestCaseResolutionStatusRepositoryTest {

  @Test
  void testAddOriginEntityFQNJoin_withOriginEntityFQN() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("originEntityFQN", "test.table");

    String result =
        CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.addOriginEntityFQNJoin(
            filter, "WHERE 1=1");

    assertTrue(result.contains("INNER JOIN"));
    assertTrue(result.contains("test_case"));
    assertTrue(result.contains("WHERE 1=1"));
  }

  @Test
  void testAddOriginEntityFQNJoin_withInclude() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("include", "non-deleted");

    String result =
        CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.addOriginEntityFQNJoin(
            filter, "WHERE 1=1");

    assertTrue(result.contains("INNER JOIN"));
    assertTrue(result.contains("test_case"));
  }

  @Test
  void testAddOriginEntityFQNJoin_withDefaultFilter() {
    // ListFilter() default constructor sets include = Include.NON_DELETED
    // The addOriginEntityFQNJoin method adds JOIN when either originEntityFQN OR include is present
    // Since include is always set by default, the JOIN is always added
    ListFilter filter = new ListFilter();

    String result =
        CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.addOriginEntityFQNJoin(
            filter, "WHERE 1=1");

    // With default ListFilter, JOIN is added because include is set to NON_DELETED
    assertTrue(result.contains("INNER JOIN"));
    assertTrue(result.contains("WHERE 1=1"));
  }

  @Test
  void testAddOriginEntityFQNJoin_preservesCondition() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("originEntityFQN", "test.table");

    String result =
        CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.addOriginEntityFQNJoin(
            filter, "WHERE status = 'Open'");

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

  /**
   * The incident listing reads every search hit back into {@link TestCaseResolutionStatus}, which
   * rejects unknown properties, so each field the index adds for search alone has to be stripped
   * first. One left behind fails every incident on the page, which is what the parent table
   * reference did. The doc comes from the real index rather than a hand-written field list, so the
   * next field the index adds fails here instead of in the IT lanes.
   */
  @Test
  void searchOnlyFieldsOfAnIndexedIncidentAreStrippedBeforeTheStrictRead() {
    Table table = tableWithParentRelations();
    TestCase testCase = testCaseOn(table);
    TestSuite basicSuite =
        new TestSuite()
            .withId(testCase.getTestSuite().getId())
            .withName(testCase.getTestSuite().getName())
            .withBasicEntityReference(table.getEntityReference());
    TestCaseResolutionStatus incident =
        createIncident(TestCaseResolutionStatusTypes.New)
            .withTestCaseReference(testCase.getEntityReference());

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(
              () -> Entity.getEntityOrNull(eq(incident.getTestCaseReference()), anyString(), any()))
          .thenReturn(testCase);
      entity
          .when(() -> Entity.getEntityOrNull(eq(testCase.getTestSuite()), anyString(), any()))
          .thenReturn(basicSuite);
      entity
          .when(() -> Entity.getEntityByName(eq(Entity.TABLE), anyString(), anyString(), any()))
          .thenReturn(table);
      entity
          .when(() -> Entity.getEntity(any(EntityReference.class), anyString(), any()))
          .thenReturn(table);
      entity.when(() -> Entity.propagatedParentTags(any())).thenCallRealMethod();

      Map<String, Object> listedSource =
          new HashMap<>(new TestCaseResolutionStatusIndex(incident).buildSearchIndexDoc());
      TestCaseResolutionStatusRepository.SEARCH_ONLY_FIELDS.forEach(listedSource::remove);

      assertDoesNotThrow(
          () -> JsonUtils.readOrConvertValue(listedSource, TestCaseResolutionStatus.class));
    }
  }

  private static Table tableWithParentRelations() {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("orders")
        .withFullyQualifiedName("svc.db.sc.orders")
        .withDatabase(reference(Entity.DATABASE, "db"))
        .withDatabaseSchema(reference(Entity.DATABASE_SCHEMA, "sc"))
        .withService(reference(Entity.DATABASE_SERVICE, "svc"))
        .withCertification(
            new AssetCertification().withTagLabel(new TagLabel().withTagFQN("Certification.Gold")))
        .withTags(
            List.of(
                new TagLabel()
                    .withTagFQN("Glossary.Revenue")
                    .withSource(TagLabel.TagSource.GLOSSARY)
                    .withLabelType(TagLabel.LabelType.MANUAL)));
  }

  private static TestCase testCaseOn(Table table) {
    return new TestCase()
        .withId(UUID.randomUUID())
        .withName("rowCount")
        .withFullyQualifiedName(table.getFullyQualifiedName() + ".rowCount")
        .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">")
        .withTestSuite(reference(Entity.TEST_SUITE, "orders.testSuite"));
  }

  private static EntityReference reference(String type, String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(type).withName(name);
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
